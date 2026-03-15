import Anthropic from '@anthropic-ai/sdk';
import { MetricSnapshot } from '../metrics-engine/types';
import { Nudge } from '../coaching-system/types';
import { SessionConfig } from '../session/types';

const client = new Anthropic();

export interface AISessionAnalysis {
  sessionGrade: string;
  overallScore: number;
  summary: string;
  teachingEffectiveness: {
    score: number;
    methodology: string;
    strengths: string[];
    improvements: string[];
    pedagogyNotes: string;
  };
  studentEngagement: {
    score: number;
    overview: string;
    confusionAnalysis: string;
    attentionPatterns: string;
    emotionalJourney: string;
    breakthroughMoments: string[];
    strugglingMoments: string[];
  };
  communicationAnalysis: {
    talkTimeAssessment: string;
    questioningQuality: string;
    listeningSkills: string;
    turnTakingDynamics: string;
    interruptionPatterns: string;
  };
  eyeContactAnalysis: {
    tutorAssessment: string;
    studentAssessment: string;
    connectionQuality: string;
  };
  energyAnalysis: {
    overview: string;
    paceRecommendation: string;
    fatigueDetected: boolean;
    optimalMoments: string;
  };
  actionPlan: {
    immediate: string[];
    nextSession: string[];
    weeklyGoals: string[];
    longTerm: string[];
  };
  sessionHighlights: {
    bestMoment: string;
    biggestChallenge: string;
    mostImprovedArea: string;
    keyTakeaway: string;
  };
  scores: {
    engagement: number;
    communication: number;
    pedagogy: number;
    rapport: number;
    pacing: number;
  };
  detailedNarrative: string;
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
  const minEngagement = Math.min(...metrics.map(m => m.engagementScore));
  const maxEngagement = Math.max(...metrics.map(m => m.engagementScore));

  const avgTutorEye = Math.round(
    metrics.reduce((s, m) => s + m.tutor.eyeContactScore, 0) / metrics.length * 100
  );
  const avgStudentEye = Math.round(
    metrics.reduce((s, m) => s + m.student.eyeContactScore, 0) / metrics.length * 100
  );

  const lastMetric = metrics[metrics.length - 1];
  const tutorTalk = Math.round(lastMetric.tutor.talkTimePercent * 100);
  const studentTalk = Math.round(lastMetric.student.talkTimePercent * 100);

  // Energy stats
  const avgTutorEnergy = Math.round(
    metrics.reduce((s, m) => s + m.tutor.energyScore, 0) / metrics.length * 100
  );
  const avgStudentEnergy = Math.round(
    metrics.reduce((s, m) => s + m.student.energyScore, 0) / metrics.length * 100
  );

  // Student state breakdown
  const stateCounts: Record<string, number> = {};
  metrics.forEach((m) => {
    stateCounts[m.studentState] = (stateCounts[m.studentState] || 0) + 1;
  });
  const stateBreakdown = Object.entries(stateCounts)
    .map(([state, count]) => `${state}: ${Math.round((count / metrics.length) * 100)}%`)
    .join(', ');

  // Engagement trajectory (25 sample points)
  const sampleRate = Math.max(1, Math.floor(metrics.length / 25));
  const trajectory = metrics
    .filter((_, i) => i % sampleRate === 0)
    .map((m, i) => `${Math.round(i * sampleRate / 2)}s:${m.engagementScore}`)
    .join(', ');

  // State transitions
  const stateTransitions: string[] = [];
  for (let i = 1; i < metrics.length; i++) {
    if (metrics[i].studentState !== metrics[i - 1].studentState) {
      const timeMin = Math.round((metrics[i].timestamp - metrics[0].timestamp) / 60000 * 10) / 10;
      stateTransitions.push(`${timeMin}min: ${metrics[i - 1].studentState} -> ${metrics[i].studentState}`);
    }
  }

  // Engagement changes
  const significantChanges: string[] = [];
  for (let i = 1; i < metrics.length; i++) {
    const diff = metrics[i].engagementScore - metrics[i - 1].engagementScore;
    if (Math.abs(diff) > 10) {
      const timeMin = Math.round((metrics[i].timestamp - metrics[0].timestamp) / 60000 * 10) / 10;
      significantChanges.push(
        `${timeMin}min: ${diff > 0 ? '+' : ''}${diff} (${metrics[i - 1].engagementScore}->${metrics[i].engagementScore}, state: ${metrics[i].studentState})`
      );
    }
  }

  // Engagement by quarter
  const quarterSize = Math.floor(metrics.length / 4);
  const quarters = [0, 1, 2, 3].map(q => {
    const slice = metrics.slice(q * quarterSize, (q + 1) * quarterSize);
    if (slice.length === 0) return 0;
    return Math.round(slice.reduce((s, m) => s + m.engagementScore, 0) / slice.length);
  });

  const nudgeSummary = nudges.length > 0
    ? nudges.slice(0, 15).map((n) => {
        const timeMin = metrics.length > 0
          ? Math.round((n.timestamp - metrics[0].timestamp) / 60000 * 10) / 10
          : 0;
        return `  ${timeMin}min [${n.priority}] ${n.message}`;
      }).join('\n')
    : 'None triggered';

  return `TUTORING SESSION ANALYSIS DATA:

CONTEXT:
- Subject: ${config.subject}
- Session Type: ${config.sessionType} (${config.sessionType === 'lecture' ? 'tutor explains, student listens' : config.sessionType === 'practice' ? 'student practices, tutor guides' : 'interactive discussion'})
- Student Level: ${config.studentLevel}
- Tutor: ${config.tutorName}, Student: ${config.studentName}
- Duration: ${duration} minutes

ENGAGEMENT METRICS:
- Average Engagement: ${avgEngagement}/100 (min: ${minEngagement}, max: ${maxEngagement})
- Engagement by Quarter: Q1=${quarters[0]}, Q2=${quarters[1]}, Q3=${quarters[2]}, Q4=${quarters[3]}
- Engagement Timeline: [${trajectory}]

VISUAL ATTENTION:
- Tutor Eye Contact: ${avgTutorEye}% average
- Student Eye Contact: ${avgStudentEye}% average

COMMUNICATION:
- Speaking Time: Tutor ${tutorTalk}% / Student ${studentTalk}%
- Interruptions: ${lastMetric.session.interruptionCount}
- Turn Count: ${lastMetric.session.turnCount} speaker switches
- Avg Turn Gap: ${lastMetric.session.turnTakingGapMs > 0 ? (lastMetric.session.turnTakingGapMs / 1000).toFixed(1) + 's' : 'N/A'}

ENERGY LEVELS:
- Tutor Energy: ${avgTutorEnergy}% average
- Student Energy: ${avgStudentEnergy}% average

STUDENT STATE BREAKDOWN:
${stateBreakdown}

STATE TRANSITIONS (${stateTransitions.length} total):
${stateTransitions.slice(0, 10).join('\n') || 'No transitions detected'}

SIGNIFICANT ENGAGEMENT CHANGES:
${significantChanges.slice(0, 10).join('\n') || 'No significant changes'}

COACHING NUDGES TRIGGERED (${nudges.length} total):
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
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are a world-class educational psychologist and teaching coach analyzing a live tutoring session. You have deep expertise in pedagogy, student engagement, and instructional design.

Based on the real-time engagement data captured during this session, provide an extremely thorough and actionable analysis. Be specific — reference actual numbers, timestamps, and patterns from the data. Don't be generic.

${context}

Respond in this exact JSON format (no markdown wrapping, pure JSON):
{
  "sessionGrade": "A/B/C/D/F",
  "overallScore": <0-100>,
  "summary": "3-4 sentence executive summary — specific to this session's data, not generic",
  "teachingEffectiveness": {
    "score": <1-10>,
    "methodology": "Assessment of teaching approach based on session type and engagement patterns",
    "strengths": ["specific strength with data reference", "another strength"],
    "improvements": ["specific improvement with data reference", "another improvement"],
    "pedagogyNotes": "Educational theory perspective on what worked and why"
  },
  "studentEngagement": {
    "score": <1-10>,
    "overview": "Analysis of how engaged the student was and why",
    "confusionAnalysis": "When and why the student appeared confused, with timestamps",
    "attentionPatterns": "How attention varied throughout the session",
    "emotionalJourney": "The student's emotional arc during the session",
    "breakthroughMoments": ["specific moment where engagement peaked"],
    "strugglingMoments": ["specific moment where student struggled"]
  },
  "communicationAnalysis": {
    "talkTimeAssessment": "Was the talk time ratio appropriate for this session type?",
    "questioningQuality": "Assessment of questioning techniques based on turn-taking patterns",
    "listeningSkills": "Evidence of active listening from the data",
    "turnTakingDynamics": "How natural was the conversational flow?",
    "interruptionPatterns": "Analysis of any interruption patterns"
  },
  "eyeContactAnalysis": {
    "tutorAssessment": "Tutor's eye contact pattern and what it indicates",
    "studentAssessment": "Student's eye contact pattern and what it indicates",
    "connectionQuality": "Overall visual connection quality between tutor and student"
  },
  "energyAnalysis": {
    "overview": "How energy levels changed throughout the session",
    "paceRecommendation": "Should the pace be faster, slower, or varied?",
    "fatigueDetected": true/false,
    "optimalMoments": "When was the energy at its best and why?"
  },
  "actionPlan": {
    "immediate": ["do this right after the session"],
    "nextSession": ["change this next time"],
    "weeklyGoals": ["practice this skill this week"],
    "longTerm": ["develop this teaching competency"]
  },
  "sessionHighlights": {
    "bestMoment": "The single best moment in the session",
    "biggestChallenge": "The biggest challenge faced",
    "mostImprovedArea": "What improved most during the session",
    "keyTakeaway": "One sentence the tutor should remember"
  },
  "scores": {
    "engagement": <0-100>,
    "communication": <0-100>,
    "pedagogy": <0-100>,
    "rapport": <0-100>,
    "pacing": <0-100>
  },
  "detailedNarrative": "4-5 paragraph detailed coaching narrative. Start with what went well, then address challenges, then provide specific tactical advice. Reference data points. Write as if speaking directly to the tutor."
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text) as AISessionAnalysis;
  } catch {
    return {
      sessionGrade: 'C',
      overallScore: 50,
      summary: text.slice(0, 300),
      teachingEffectiveness: { score: 5, methodology: '', strengths: [], improvements: [], pedagogyNotes: '' },
      studentEngagement: { score: 5, overview: '', confusionAnalysis: '', attentionPatterns: '', emotionalJourney: '', breakthroughMoments: [], strugglingMoments: [] },
      communicationAnalysis: { talkTimeAssessment: '', questioningQuality: '', listeningSkills: '', turnTakingDynamics: '', interruptionPatterns: '' },
      eyeContactAnalysis: { tutorAssessment: '', studentAssessment: '', connectionQuality: '' },
      energyAnalysis: { overview: '', paceRecommendation: '', fatigueDetected: false, optimalMoments: '' },
      actionPlan: { immediate: [], nextSession: [], weeklyGoals: [], longTerm: [] },
      sessionHighlights: { bestMoment: '', biggestChallenge: '', mostImprovedArea: '', keyTakeaway: '' },
      scores: { engagement: 50, communication: 50, pedagogy: 50, rapport: 50, pacing: 50 },
      detailedNarrative: text,
    };
  }
}
