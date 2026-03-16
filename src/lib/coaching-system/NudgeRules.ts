import { NudgeRule } from './types';

// Threshold multipliers per session type
const SILENCE_THRESHOLDS = {
  lecture: { long: 30000, critical: 60000 },
  discussion: { long: 20000, critical: 45000 },
  practice: { long: 15000, critical: 30000 },
};

const TALK_DOMINATION_THRESHOLD = {
  lecture: 0.90,
  discussion: 0.70,
  practice: 0.60,
};

export function createNudgeRules(sessionType: 'lecture' | 'discussion' | 'practice' = 'discussion'): NudgeRule[] {
  const silence = SILENCE_THRESHOLDS[sessionType];
  const talkThreshold = TALK_DOMINATION_THRESHOLD[sessionType];

  return [
    // ── Welcome nudge — fires immediately to confirm system is live ──
    {
      id: 'session-started',
      trigger: (m) => m.session.elapsedMs > 5000 && m.session.elapsedMs < 20000,
      message: "Session active! Monitoring engagement and providing coaching tips.",
      icon: '👋',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },

    // ── Silence-based ──
    {
      id: 'student-silent-long',
      trigger: (m) => m.student.silenceDurationMs > silence.long,
      message: "Check for understanding — student hasn't spoken in a while",
      icon: '💬',
      priority: 'medium',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },
    {
      id: 'student-silent-critical',
      trigger: (m) => m.student.silenceDurationMs > silence.critical,
      message: `Extended silence — consider a direct question to re-engage`,
      icon: '🚨',
      priority: 'high',
      cooldownMs: 45000,
      sensitivity: 'low',
    },

    // ── Eye contact ──
    {
      id: 'low-student-eye-contact',
      trigger: (m) => m.student.eyeContactScore < 0.3 && m.session.elapsedMs > 10000,
      message: "Student may be distracted — try engaging them directly",
      icon: '👁',
      priority: 'medium',
      cooldownMs: 25000,
      sensitivity: 'medium',
    },

    // ── Talk time balance ──
    {
      id: 'tutor-dominating',
      trigger: (m) => m.tutor.talkTimePercent > talkThreshold && m.session.elapsedMs > 20000,
      message: sessionType === 'lecture'
        ? "Consider pausing for a comprehension check"
        : "You've been talking a lot — try asking a question",
      icon: '🎤',
      priority: 'low',
      cooldownMs: 40000,
      sensitivity: 'medium',
    },

    // ── Energy ──
    {
      id: 'energy-drop',
      trigger: (m) => m.student.energyScore < 0.25 && m.session.elapsedMs > 15000,
      message: "Energy seems low — consider a change of pace",
      icon: '⚡',
      priority: 'low',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },

    // ── Interruptions ──
    {
      id: 'interruption-spike',
      trigger: (m) => {
        const rate = m.session.elapsedMs > 0
          ? (m.session.interruptionCount / (m.session.elapsedMs / 300000))
          : 0;
        return rate > 3 && m.session.interruptionCount > 2;
      },
      message: "Frequent interruptions detected — try giving more wait time after questions",
      icon: '✋',
      priority: 'medium',
      cooldownMs: 45000,
      sensitivity: 'high',
    },

    // ── Attention drift ──
    {
      id: 'attention-drift',
      trigger: (m) => m.session.attentionDriftDetected && m.session.elapsedMs > 10000,
      message: "Attention drift detected — try a check-in or interactive question",
      icon: '🎯',
      priority: 'high',
      cooldownMs: 25000,
      sensitivity: 'medium',
    },

    // ── Student state nudges ──
    {
      id: 'student-confused',
      trigger: (m) => m.studentState === 'confused' && m.session.elapsedMs > 10000,
      message: "Student may be confused — try rephrasing or asking what's unclear",
      icon: '🤔',
      priority: 'high',
      cooldownMs: 25000,
      sensitivity: 'medium',
    },
    {
      id: 'student-struggling',
      trigger: (m) => m.studentState === 'struggling' && m.session.elapsedMs > 15000,
      message: "Student appears to be struggling — consider breaking the topic into smaller steps",
      icon: '📚',
      priority: 'high',
      cooldownMs: 30000,
      sensitivity: 'low',
    },
    {
      id: 'student-drifting',
      trigger: (m) => m.studentState === 'drifting' && m.session.elapsedMs > 10000,
      message: "Student appears to be drifting — try re-engaging with a direct question",
      icon: '💤',
      priority: 'medium',
      cooldownMs: 25000,
      sensitivity: 'medium',
    },
    {
      id: 'student-passive',
      trigger: (m) => m.studentState === 'passive' && m.session.elapsedMs > 20000 && m.student.talkTimePercent < 0.10,
      message: "Student is very passive — try an open-ended question",
      icon: '😶',
      priority: 'medium',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },

    // ── Engagement score nudges ──
    {
      id: 'engagement-plummeting',
      trigger: (m) => m.engagementScore < 40 && m.session.elapsedMs > 15000,
      message: "Engagement is critically low — consider switching approaches",
      icon: '📉',
      priority: 'high',
      cooldownMs: 30000,
      sensitivity: 'low',
    },
    {
      id: 'tutor-too-fast',
      trigger: (m) =>
        m.tutor.speechRate > 0.7 &&
        m.student.talkTimePercent < 0.15 &&
        m.session.elapsedMs > 15000,
      message: "You may be going too fast — pause and check if the student is following",
      icon: '🐢',
      priority: 'medium',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },

    // ── Positive reinforcement nudges ──
    {
      id: 'great-turn-taking',
      trigger: (m) =>
        m.session.turnCount > 2 &&
        m.session.turnTakingGapMs > 0 &&
        m.session.turnTakingGapMs < 3000 &&
        m.engagementScore > 50 &&
        m.session.elapsedMs > 20000,
      message: "Great dialogue! The back-and-forth is working well",
      icon: '🗣️',
      priority: 'low',
      cooldownMs: 60000,
      sensitivity: 'high',
    },
    {
      id: 'great-engagement',
      trigger: (m) => m.engagementScore > 65 && m.session.elapsedMs > 20000,
      message: "Great engagement! Keep up this pace",
      icon: '🌟',
      priority: 'low',
      cooldownMs: 60000,
      sensitivity: 'high',
    },
    {
      id: 'session-recovery',
      trigger: (m) =>
        m.session.engagementTrend === 'rising' &&
        m.engagementScore > 45 &&
        m.session.elapsedMs > 15000,
      message: "Engagement is recovering — whatever you changed is working!",
      icon: '📈',
      priority: 'low',
      cooldownMs: 60000,
      sensitivity: 'high',
    },

    // ── Expression & body language nudges ──
    {
      id: 'high-blink-rate',
      trigger: (m) => (m.student.blinkRate ?? 0) > 25 && m.session.elapsedMs > 15000,
      message: "Elevated blink rate — may indicate fatigue or stress",
      icon: '😫',
      priority: 'low',
      cooldownMs: 40000,
      sensitivity: 'high',
    },
    {
      id: 'student-fidgeting',
      trigger: (m) => (m.student.headMovement ?? 0) > 0.6 && m.session.elapsedMs > 15000,
      message: "Student appears restless — try an interactive activity",
      icon: '🫨',
      priority: 'medium',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },
    {
      id: 'high-distraction',
      trigger: (m) => (m.student.distractionScore ?? 0) > 0.7 && m.session.elapsedMs > 10000,
      message: "High distraction detected — try refocusing with a direct question",
      icon: '🎯',
      priority: 'high',
      cooldownMs: 25000,
      sensitivity: 'medium',
    },
    {
      id: 'student-frustration',
      trigger: (m) => {
        const expr = m.studentExpression;
        return expr !== null && (expr.frustration ?? 0) > 0.5 && m.session.elapsedMs > 10000;
      },
      message: "Student may be frustrated — offer a different approach",
      icon: '😤',
      priority: 'high',
      cooldownMs: 30000,
      sensitivity: 'medium',
    },
    {
      id: 'student-high-interest',
      trigger: (m) => {
        const expr = m.studentExpression;
        return expr !== null && (expr.interest ?? 0) > 0.6 && m.engagementScore > 50 && m.session.elapsedMs > 15000;
      },
      message: "Student is showing high interest — great time for a new concept!",
      icon: '🔥',
      priority: 'low',
      cooldownMs: 60000,
      sensitivity: 'high',
    },
    {
      id: 'focus-streak-celebration',
      trigger: (m) => (m.session.focusStreakMs ?? 0) > 60000 && m.engagementScore > 50,
      message: "1+ minute focus streak! Student is deeply engaged",
      icon: '🏆',
      priority: 'low',
      cooldownMs: 60000,
      sensitivity: 'high',
    },
    {
      id: 'slouching-detected',
      trigger: (m) => m.student.posture === 'slouching' && m.session.elapsedMs > 15000,
      message: "Student's posture suggests low energy",
      icon: '🧘',
      priority: 'low',
      cooldownMs: 45000,
      sensitivity: 'high',
    },

    // ── Topic relevance ──
    {
      id: 'off-topic-warning',
      trigger: (m) =>
        m.tutor.talkTimePercent > 0.5 &&
        m.session.elapsedMs > 20000 &&
        (m.session as any).topicRelevanceScore !== undefined &&
        (m.session as any).topicRelevanceScore < 0.15,
      message: "You may be drifting off-topic — steer back to the session subject",
      icon: '🎯',
      priority: 'medium',
      cooldownMs: 40000,
      sensitivity: 'medium',
    },
  ];
}

// Keep backward compatibility
export const DEFAULT_NUDGE_RULES = createNudgeRules('discussion');
