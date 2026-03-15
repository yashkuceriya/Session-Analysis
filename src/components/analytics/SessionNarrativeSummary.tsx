'use client';

import { MetricSnapshot } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';
import { SessionConfig } from '@/lib/session/types';

interface SessionNarrativeSummaryProps {
  metricsHistory: MetricSnapshot[];
  nudgeHistory: Nudge[];
  sessionConfig: SessionConfig;
  startTime: number;
}

interface SessionStats {
  durationMinutes: number;
  avgEngagement: number;
  minEngagement: number;
  maxEngagement: number;
  tutorTalkPercent: number;
  studentTalkPercent: number;
  avgEyeContactTutor: number;
  avgEyeContactStudent: number;
  eyeContactTrendTutor: 'rising' | 'stable' | 'declining';
  eyeContactTrendStudent: 'rising' | 'stable' | 'declining';
  stateDistribution: Record<string, number>;
  expressionAverages: {
    tutor: ExpressionAverages | null;
    student: ExpressionAverages | null;
  };
  interruptionCount: number;
  avgTurnGapMs: number;
  turnCount: number;
  confusionMoments: { timestamp: number; minute: number }[];
}

interface ExpressionAverages {
  smile: number;
  concentration: number;
  confusion: number;
  surprise: number;
  energy: number;
  valence: number;
  browFurrow: number;
}

function computeSessionStats(
  metricsHistory: MetricSnapshot[],
  startTime: number
): SessionStats {
  if (metricsHistory.length === 0) {
    return {
      durationMinutes: 0,
      avgEngagement: 0,
      minEngagement: 0,
      maxEngagement: 0,
      tutorTalkPercent: 0,
      studentTalkPercent: 0,
      avgEyeContactTutor: 0,
      avgEyeContactStudent: 0,
      eyeContactTrendTutor: 'stable',
      eyeContactTrendStudent: 'stable',
      stateDistribution: {},
      expressionAverages: { tutor: null, student: null },
      interruptionCount: 0,
      avgTurnGapMs: 0,
      turnCount: 0,
      confusionMoments: [],
    };
  }

  let engagement = 0;
  let minEngagement = 100;
  let maxEngagement = 0;
  let tutorTalk = 0;
  let studentTalk = 0;
  let eyeContactTutor = 0;
  let eyeContactStudent = 0;
  let interruptionCount = 0;
  let turnGapSum = 0;
  let turnCount = 0;
  let stateDistribution: Record<string, number> = {};

  const tutorExpressionValues = {
    smile: [] as number[],
    concentration: [] as number[],
    confusion: [] as number[],
    surprise: [] as number[],
    energy: [] as number[],
    valence: [] as number[],
    browFurrow: [] as number[],
  };

  const studentExpressionValues = {
    smile: [] as number[],
    concentration: [] as number[],
    confusion: [] as number[],
    surprise: [] as number[],
    energy: [] as number[],
    valence: [] as number[],
    browFurrow: [] as number[],
  };

  const confusionMoments: { timestamp: number; minute: number }[] = [];

  metricsHistory.forEach((snapshot, index) => {
    // Engagement
    engagement += snapshot.engagementScore;
    minEngagement = Math.min(minEngagement, snapshot.engagementScore);
    maxEngagement = Math.max(maxEngagement, snapshot.engagementScore);

    // Talk time
    tutorTalk += snapshot.tutor.talkTimePercent;
    studentTalk += snapshot.student.talkTimePercent;

    // Eye contact
    eyeContactTutor += snapshot.tutor.eyeContactScore;
    eyeContactStudent += snapshot.student.eyeContactScore;

    // Interruptions
    interruptionCount += snapshot.session.interruptionCount;

    // Turn taking
    if (snapshot.session.turnTakingGapMs > 0) {
      turnGapSum += snapshot.session.turnTakingGapMs;
      turnCount++;
    }

    // State distribution
    const state = snapshot.studentState;
    stateDistribution[state] = (stateDistribution[state] || 0) + 1;

    // Expression data
    if (snapshot.tutorExpression) {
      tutorExpressionValues.smile.push(snapshot.tutorExpression.smile);
      tutorExpressionValues.concentration.push(snapshot.tutorExpression.concentration);
      tutorExpressionValues.confusion.push(snapshot.tutorExpression.confusion);
      tutorExpressionValues.surprise.push(snapshot.tutorExpression.surprise);
      tutorExpressionValues.energy.push(snapshot.tutorExpression.energy);
      tutorExpressionValues.valence.push(snapshot.tutorExpression.valence);
      tutorExpressionValues.browFurrow.push(snapshot.tutorExpression.browFurrow);
    }

    if (snapshot.studentExpression) {
      studentExpressionValues.smile.push(snapshot.studentExpression.smile);
      studentExpressionValues.concentration.push(snapshot.studentExpression.concentration);
      studentExpressionValues.confusion.push(snapshot.studentExpression.confusion);
      studentExpressionValues.surprise.push(snapshot.studentExpression.surprise);
      studentExpressionValues.energy.push(snapshot.studentExpression.energy);
      studentExpressionValues.valence.push(snapshot.studentExpression.valence);
      studentExpressionValues.browFurrow.push(snapshot.studentExpression.browFurrow);

      // Track confusion moments
      if (snapshot.studentExpression.confusion > 0.5) {
        const minuteElapsed = Math.round(
          (snapshot.timestamp - startTime) / 60000
        );
        confusionMoments.push({ timestamp: snapshot.timestamp, minute: minuteElapsed });
      }
    }
  });

  const n = metricsHistory.length;
  const durationMs = metricsHistory[n - 1].timestamp - startTime;
  const durationMinutes = Math.round(durationMs / 60000 * 10) / 10;

  // Normalize talk time
  const totalTalkTime = tutorTalk + studentTalk || 1;
  const tutorTalkPercent = Math.round((tutorTalk / totalTalkTime) * 100);
  const studentTalkPercent = Math.round((studentTalk / totalTalkTime) * 100);

  // Average eye contact (0-1 to 0-100)
  const avgEyeContactTutor = Math.round((eyeContactTutor / n) * 100);
  const avgEyeContactStudent = Math.round((eyeContactStudent / n) * 100);

  // Eye contact trends (simple: compare first third vs last third)
  const thirdSize = Math.max(1, Math.floor(n / 3));
  const eyeContactTrendTutor = getExpression(
    metricsHistory
      .slice(0, thirdSize)
      .reduce((sum, s) => sum + s.tutor.eyeContactScore, 0) / thirdSize,
    metricsHistory
      .slice(n - thirdSize)
      .reduce((sum, s) => sum + s.tutor.eyeContactScore, 0) / thirdSize
  );
  const eyeContactTrendStudent = getExpression(
    metricsHistory
      .slice(0, thirdSize)
      .reduce((sum, s) => sum + s.student.eyeContactScore, 0) / thirdSize,
    metricsHistory
      .slice(n - thirdSize)
      .reduce((sum, s) => sum + s.student.eyeContactScore, 0) / thirdSize
  );

  // Compute expression averages
  const computeExpressionAverages = (
    values: typeof tutorExpressionValues
  ): ExpressionAverages | null => {
    if (
      !values.smile.length ||
      !values.concentration.length ||
      !values.confusion.length ||
      !values.surprise.length ||
      !values.energy.length ||
      !values.valence.length ||
      !values.browFurrow.length
    ) {
      return null;
    }

    return {
      smile: Math.round(
        (values.smile.reduce((a, b) => a + b, 0) / values.smile.length) * 100
      ),
      concentration: Math.round(
        (values.concentration.reduce((a, b) => a + b, 0) /
          values.concentration.length) *
          100
      ),
      confusion: Math.round(
        (values.confusion.reduce((a, b) => a + b, 0) / values.confusion.length) *
          100
      ),
      surprise: Math.round(
        (values.surprise.reduce((a, b) => a + b, 0) / values.surprise.length) *
          100
      ),
      energy: Math.round(
        (values.energy.reduce((a, b) => a + b, 0) / values.energy.length) * 100
      ),
      valence: Math.round(
        (values.valence.reduce((a, b) => a + b, 0) / values.valence.length) *
          100
      ),
      browFurrow: Math.round(
        (values.browFurrow.reduce((a, b) => a + b, 0) /
          values.browFurrow.length) *
          100
      ),
    };
  };

  return {
    durationMinutes,
    avgEngagement: Math.round(engagement / n),
    minEngagement: Math.round(minEngagement),
    maxEngagement: Math.round(maxEngagement),
    tutorTalkPercent,
    studentTalkPercent,
    avgEyeContactTutor,
    avgEyeContactStudent,
    eyeContactTrendTutor,
    eyeContactTrendStudent,
    stateDistribution,
    expressionAverages: {
      tutor: computeExpressionAverages(tutorExpressionValues),
      student: computeExpressionAverages(studentExpressionValues),
    },
    interruptionCount,
    avgTurnGapMs: turnCount > 0 ? Math.round(turnGapSum / turnCount) : 0,
    turnCount: metricsHistory[n - 1].session.turnCount,
    confusionMoments,
  };
}

function getExpression(
  first: number,
  last: number
): 'rising' | 'stable' | 'declining' {
  const diff = last - first;
  if (diff > 0.05) return 'rising';
  if (diff < -0.05) return 'declining';
  return 'stable';
}

function getEngagementQuality(avg: number): string {
  if (avg >= 80) return 'excellent';
  if (avg >= 70) return 'solid';
  if (avg >= 50) return 'moderate';
  return 'low';
}

function getStatePercentage(
  stateDistribution: Record<string, number>,
  state: string
): number {
  const total = Object.values(stateDistribution).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round(((stateDistribution[state] || 0) / total) * 100);
}

function formatTone(
  value: number,
  good: number,
  poor: number
): 'positive' | 'neutral' | 'caution' {
  if (value >= good) return 'positive';
  if (value <= poor) return 'caution';
  return 'neutral';
}

interface NarrativeSection {
  text: string;
  tone: 'positive' | 'neutral' | 'caution';
}

function buildNarrative(stats: SessionStats, config: SessionConfig): NarrativeSection[] {
  const sections: NarrativeSection[] = [];

  // Opening paragraph
  const engagementQuality = getEngagementQuality(stats.avgEngagement);
  const engagementTone = formatTone(stats.avgEngagement, 75, 50);
  const primaryState = Object.entries(stats.stateDistribution).sort(
    ([, a], [, b]) => b - a
  )[0]?.[0] || 'engaged';
  const primaryStatePercent = getStatePercentage(stats.stateDistribution, primaryState);

  let openingText = `This ${stats.durationMinutes}-minute ${config.sessionType} session between ${config.tutorName} and ${config.studentName} on ${config.subject} maintained a ${engagementQuality} average engagement of ${stats.avgEngagement}%. `;

  if (primaryStatePercent > 50) {
    openingText += `The student was primarily ${primaryState}, `;
  } else {
    openingText += `The student displayed varied engagement states. `;
  }

  openingText += `Eye contact averaged ${stats.avgEyeContactStudent}% for the student and ${stats.avgEyeContactTutor}% for the tutor, both showing ${stats.eyeContactTrendStudent} trends throughout the session.`;

  sections.push({
    text: openingText,
    tone: engagementTone,
  });

  // Expression paragraph
  if (stats.expressionAverages.student) {
    const expr = stats.expressionAverages.student;
    const valenceTone = formatTone(expr.valence, 70, 40);

    let expressionText = `Facial expression analysis of ${config.studentName} revealed that the student displayed frequent ${expr.concentration > 60 ? 'concentration' : 'attention'} (averaging ${expr.concentration}%)`;

    if (expr.smile > 40) {
      expressionText += ` and frequent smiling (${expr.smile}%), suggesting active intellectual engagement`;
    } else {
      expressionText += `, with moderate levels of positive expression`;
    }

    expressionText += `. `;

    if (stats.confusionMoments.length > 0) {
      expressionText += `Brief periods of confusion were detected at approximately ${stats.confusionMoments
        .slice(0, 2)
        .map((m) => `the ${m.minute}-minute mark`)
        .join(' and ')}, suggesting moments where the material may have been challenging. `;
    }

    expressionText += `The student's overall emotional valence was ${
      expr.valence > 70 ? 'positive' : expr.valence > 40 ? 'neutral' : 'guarded'
    } (${expr.valence}%), indicating ${expr.valence > 60 ? 'strong' : expr.valence > 40 ? 'moderate' : 'limited'} comfort with the material.`;

    sections.push({
      text: expressionText,
      tone: valenceTone,
    });
  }

  // Interaction paragraph
  const talkTimeTone = formatTone(stats.studentTalkPercent, 50, 20);
  let interactionText = `The conversation flow was ${Math.abs(stats.tutorTalkPercent - stats.studentTalkPercent) < 15 ? 'well-balanced' : 'tutor-focused'}, with ${config.tutorName} speaking ${stats.tutorTalkPercent}% of the time and ${config.studentName} contributing ${stats.studentTalkPercent}%. `;

  if (stats.turnCount > 0) {
    interactionText += `There were ${stats.turnCount} natural turn exchanges with an average response gap of ${Math.round(stats.avgTurnGapMs / 1000 * 10) / 10} seconds, indicating ${stats.avgTurnGapMs < 3000 ? 'active' : 'deliberate'} listening. `;
  }

  if (stats.interruptionCount > 2) {
    interactionText += `${stats.interruptionCount} interruptions were recorded, which may have slightly disrupted the session flow.`;
  } else if (stats.interruptionCount > 0) {
    interactionText += `${stats.interruptionCount} brief interruption${stats.interruptionCount === 1 ? ' was' : 's were'} recorded but did not appear to disrupt the session flow.`;
  } else {
    interactionText += `The session was free of interruptions, maintaining a smooth conversation flow.`;
  }

  sections.push({
    text: interactionText,
    tone: talkTimeTone,
  });

  // Closing paragraph
  const overallTone =
    stats.avgEngagement >= 70 && stats.studentTalkPercent >= 30 ? 'positive' : 'neutral';

  let closingText = `Overall, this was a ${stats.avgEngagement >= 75 ? 'highly productive' : stats.avgEngagement >= 60 ? 'productive' : 'moderate'} session with ${Math.abs(stats.tutorTalkPercent - stats.studentTalkPercent) < 15 ? 'strong two-way' : 'tutor-driven'} engagement. `;

  const suggestions: string[] = [];

  if (stats.confusionMoments.length > 0) {
    suggestions.push(
      'checking for understanding after introducing new concepts'
    );
  }

  if (stats.studentTalkPercent < 30 && config.sessionType === 'discussion') {
    suggestions.push('encouraging more student contributions');
  }

  if (stats.interruptionCount > 2) {
    suggestions.push('minimizing interruptions');
  }

  if (stats.avgEyeContactStudent < 50) {
    suggestions.push('improving eye contact');
  }

  if (suggestions.length > 0) {
    closingText += `To further enhance future sessions, consider ${suggestions.join(', ')}. These adjustments could further improve session quality.`;
  } else {
    closingText += `The session demonstrates strong facilitation practices and student engagement.`;
  }

  sections.push({
    text: closingText,
    tone: overallTone,
  });

  return sections;
}

export function SessionNarrativeSummary({
  metricsHistory,
  nudgeHistory,
  sessionConfig,
  startTime,
}: SessionNarrativeSummaryProps) {
  if (metricsHistory.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Session Summary</h3>
        <p className="text-xs text-[var(--muted-light)]">No metrics available</p>
      </div>
    );
  }

  const stats = computeSessionStats(metricsHistory, startTime);
  const narrative = buildNarrative(stats, sessionConfig);

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium text-[var(--foreground)]">Session Summary</h3>
        <span className="inline-flex items-center gap-1 text-xs bg-[var(--card-hover)] text-[var(--muted)] px-2 py-1 rounded-md">
          📊 AI-free analysis
        </span>
      </div>

      <div className="space-y-4">
        {narrative.map((section, idx) => (
          <p
            key={idx}
            className={`text-sm leading-relaxed ${
              section.tone === 'positive'
                ? 'text-[var(--success)]'
                : section.tone === 'caution'
                  ? 'text-[var(--warning)]'
                  : 'text-[var(--foreground)]'
            }`}
          >
            {section.text.split(/(\d+(?:\.\d+)?%?)/).map((part, i) => {
              // Highlight percentage numbers and numeric values
              if (/(\d+(?:\.\d+)?%?)/.test(part)) {
                return (
                  <span key={i} className="font-medium text-[var(--foreground)]">
                    {part}
                  </span>
                );
              }
              return part;
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
