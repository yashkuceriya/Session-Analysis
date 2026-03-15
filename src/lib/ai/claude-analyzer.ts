import Anthropic from '@anthropic-ai/sdk';
import { MetricSnapshot, StudentState } from '../metrics-engine/types';
import { Nudge } from '../coaching-system/types';
import { SessionConfig } from '../session/types';

const client = new Anthropic();

export interface AISessionAnalysis {
  summary: string;
  teachingEffectiveness: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  studentEngagement: {
    overview: string;
    confusionMoments: string[];
    breakthroughMoments: string[];
  };
  actionPlan: {
    immediate: string[];
    nextSession: string[];
    longTerm: string[];
  };
  sessionGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  detailedFeedback: string;
}

function buildSessionContext(
  metrics: MetricSnapshot[],
  nudges: Nudge[],
  config: SessionConfig
): string {
  if (metrics.length === 0) return 'No metrics available.';

  const duration = metrics.length > 1
    ? Math.round((metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 60000)
    : 0;

  const avgEngagement = Math.round(
    metrics.reduce((s, m) => s + m.engagementScore, 0) / metrics.length
  );

  const avgTutorEye = Math.round(
    metrics.reduce((s, m) => s + m.tutor.eyeContactScore, 0) / metrics.length * 100
  );
  const avgStudentEye = Math.round(
    metrics.reduce((s, m) => s + m.student.eyeContactScore, 0) / metrics.length * 100
  );

  const lastMetric = metrics[metrics.length - 1];
  const tutorTalk = Math.round(lastMetric.tutor.talkTimePercent * 100);
  const studentTalk = Math.round(lastMetric.student.talkTimePercent * 100);

  // Student state breakdown
  const stateCounts: Record<string, number> = {};
  metrics.forEach((m) => {
    stateCounts[m.studentState] = (stateCounts[m.studentState] || 0) + 1;
  });
  const stateBreakdown = Object.entries(stateCounts)
    .map(([state, count]) => `${state}: ${Math.round((count / metrics.length) * 100)}%`)
    .join(', ');

  // Engagement trajectory (sample every 10th point)
  const trajectory = metrics
    .filter((_, i) => i % Math.max(1, Math.floor(metrics.length / 20)) === 0)
    .map((m) => m.engagementScore)
    .join(', ');

  // Key moments
  const engagementDrops: string[] = [];
  for (let i = 1; i < metrics.length; i++) {
    if (metrics[i - 1].engagementScore - metrics[i].engagementScore > 15) {
      const timeMin = Math.round((metrics[i].timestamp - metrics[0].timestamp) / 60000);
      engagementDrops.push(
        `${timeMin}min: dropped from ${metrics[i - 1].engagementScore} to ${metrics[i].engagementScore} (state: ${metrics[i].studentState})`
      );
    }
  }

  const nudgeSummary = nudges.length > 0
    ? nudges.map((n) => `[${n.priority}] ${n.message}`).join('\n  ')
    : 'None triggered';

  return `SESSION DATA:
- Subject: ${config.subject}
- Type: ${config.sessionType}
- Student Level: ${config.studentLevel}
- Duration: ${duration} minutes
- Avg Engagement: ${avgEngagement}/100
- Tutor Eye Contact: ${avgTutorEye}%
- Student Eye Contact: ${avgStudentEye}%
- Speaking Time: Tutor ${tutorTalk}% / Student ${studentTalk}%
- Interruptions: ${lastMetric.session.interruptionCount}
- Turn Count: ${lastMetric.session.turnCount}
- Student States: ${stateBreakdown}
- Engagement Trajectory (sampled): [${trajectory}]
- Engagement Drops: ${engagementDrops.length > 0 ? engagementDrops.join('; ') : 'None significant'}
- Coaching Nudges (${nudges.length} total):
  ${nudgeSummary}`;
}

export async function analyzeSessionWithAI(
  metrics: MetricSnapshot[],
  nudges: Nudge[],
  config: SessionConfig
): Promise<AISessionAnalysis> {
  const context = buildSessionContext(metrics, nudges, config);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are an expert educational coach analyzing a live tutoring session. Based on the engagement metrics data below, provide a detailed analysis.

${context}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "summary": "2-3 sentence overview of the session quality",
  "teachingEffectiveness": {
    "score": <1-10>,
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"]
  },
  "studentEngagement": {
    "overview": "1-2 sentences about student engagement patterns",
    "confusionMoments": ["description of when/why student was confused"],
    "breakthroughMoments": ["description of when engagement peaked"]
  },
  "actionPlan": {
    "immediate": ["what to do right now"],
    "nextSession": ["what to change next time"],
    "longTerm": ["skills to develop over time"]
  },
  "sessionGrade": "<A/B/C/D/F>",
  "detailedFeedback": "2-3 paragraph detailed coaching feedback for the tutor"
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text) as AISessionAnalysis;
  } catch {
    // If Claude doesn't return valid JSON, wrap the text
    return {
      summary: text.slice(0, 200),
      teachingEffectiveness: { score: 5, strengths: [], improvements: [] },
      studentEngagement: { overview: text.slice(0, 150), confusionMoments: [], breakthroughMoments: [] },
      actionPlan: { immediate: [], nextSession: [], longTerm: [] },
      sessionGrade: 'C',
      detailedFeedback: text,
    };
  }
}
