import { NudgeRule } from './types';

// Threshold multipliers per session type
const SILENCE_THRESHOLDS = {
  lecture: { long: 240000, critical: 420000 }, // More tolerance in lectures
  discussion: { long: 180000, critical: 300000 },
  practice: { long: 120000, critical: 240000 }, // Less tolerance in practice
};

const TALK_DOMINATION_THRESHOLD = {
  lecture: 0.90,     // 90% is fine for lectures
  discussion: 0.70,  // 70% is too much for discussion
  practice: 0.60,    // 60% is too much for practice
};

export function createNudgeRules(sessionType: 'lecture' | 'discussion' | 'practice' = 'discussion'): NudgeRule[] {
  const silence = SILENCE_THRESHOLDS[sessionType];
  const talkThreshold = TALK_DOMINATION_THRESHOLD[sessionType];

  return [
    {
      id: 'student-silent-long',
      trigger: (m) => m.student.silenceDurationMs > silence.long,
      message: "Check for understanding — student hasn't spoken in a while",
      icon: '💬',
      priority: 'medium',
      cooldownMs: 120000,
      sensitivity: 'medium',
    },
    {
      id: 'student-silent-critical',
      trigger: (m) => m.student.silenceDurationMs > silence.critical,
      message: `Student has been silent for ${Math.round(silence.critical / 60000)}+ minutes — consider a direct question`,
      icon: '🚨',
      priority: 'high',
      cooldownMs: 180000,
      sensitivity: 'low',
    },
    {
      id: 'low-student-eye-contact',
      trigger: (m) => m.student.eyeContactScore < 0.3 && m.student.eyeContactTrend === 'declining',
      message: "Student may be distracted — try engaging them directly",
      icon: '👁',
      priority: 'medium',
      cooldownMs: 60000,
      sensitivity: 'medium',
    },
    {
      id: 'tutor-dominating',
      trigger: (m) => m.tutor.talkTimePercent > talkThreshold && m.session.elapsedMs > 300000,
      message: sessionType === 'lecture'
        ? "Consider pausing for a comprehension check"
        : "You've been talking a lot — try asking a question",
      icon: '🎤',
      priority: 'low',
      cooldownMs: 300000,
      sensitivity: 'medium',
    },
    {
      id: 'energy-drop',
      trigger: (m) => m.student.energyScore < 0.25 && m.session.elapsedMs > 300000,
      message: "Energy seems low — consider a short break or change of pace",
      icon: '⚡',
      priority: 'low',
      cooldownMs: 300000,
      sensitivity: 'medium',
    },
    {
      id: 'interruption-spike',
      trigger: (m) => {
        // Rate-based: >3 interruptions in the last 5 minutes is a spike
        const rate = m.session.elapsedMs > 0
          ? (m.session.interruptionCount / (m.session.elapsedMs / 300000))
          : 0;
        return rate > 3 && m.session.interruptionCount > 3;
      },
      message: "Frequent interruptions detected — try giving more wait time after questions",
      icon: '✋',
      priority: 'medium',
      cooldownMs: 300000,
      sensitivity: 'high',
    },
    {
      id: 'attention-drift',
      trigger: (m) => m.session.attentionDriftDetected,
      message: "Attention drift detected — try a check-in or interactive question",
      icon: '🎯',
      priority: 'high',
      cooldownMs: 120000,
      sensitivity: 'medium',
    },
    // NEW: Student state-based rules
    {
      id: 'student-confused',
      trigger: (m) => m.studentState === 'confused' && m.session.elapsedMs > 60000,
      message: "Student may be confused — try rephrasing or asking what's unclear",
      icon: '🤔',
      priority: 'high',
      cooldownMs: 90000,
      sensitivity: 'medium',
    },
    {
      id: 'student-struggling',
      trigger: (m) => m.studentState === 'struggling' && m.session.elapsedMs > 120000,
      message: "Student appears to be struggling — consider breaking the topic into smaller steps",
      icon: '📚',
      priority: 'high',
      cooldownMs: 180000,
      sensitivity: 'low',
    },
    {
      id: 'student-drifting',
      trigger: (m) => m.studentState === 'drifting' && m.session.elapsedMs > 90000,
      message: "Student appears to be drifting — try re-engaging with a direct question or activity change",
      icon: '💤',
      priority: 'medium',
      cooldownMs: 120000,
      sensitivity: 'medium',
    },
    {
      id: 'student-passive',
      trigger: (m) => m.studentState === 'passive' && m.session.elapsedMs > 180000 && m.student.talkTimePercent < 0.10,
      message: "Student is very passive — try an open-ended question or hands-on exercise",
      icon: '😶',
      priority: 'medium',
      cooldownMs: 180000,
      sensitivity: 'medium',
    },
    {
      id: 'engagement-plummeting',
      trigger: (m) => m.engagementScore < 25 && m.session.elapsedMs > 180000 && m.session.engagementTrend === 'declining',
      message: "Engagement is critically low — consider taking a break or switching approaches",
      icon: '📉',
      priority: 'high',
      cooldownMs: 180000,
      sensitivity: 'low',
    },
    {
      id: 'tutor-too-fast',
      trigger: (m) =>
        m.tutor.speechRate > 0.7 &&
        m.session.engagementTrend === 'declining' &&
        m.student.talkTimePercent < 0.15 &&
        m.session.elapsedMs > 180000,
      message: "You may be going too fast — pause and check if the student is following",
      icon: '🐢',
      priority: 'medium',
      cooldownMs: 240000,
      sensitivity: 'medium',
    },
    {
      id: 'great-turn-taking',
      trigger: (m) =>
        m.session.turnCount > 6 &&
        m.session.turnTakingGapMs > 0 &&
        m.session.turnTakingGapMs < 3000 &&
        m.engagementScore > 70 &&
        m.session.elapsedMs > 300000,
      message: "Great dialogue! The back-and-forth conversation is working well",
      icon: '🗣️',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
    {
      id: 'great-engagement',
      trigger: (m) => m.engagementScore > 85 && m.session.elapsedMs > 300000,
      message: "Great engagement! Keep up this pace",
      icon: '🌟',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
    {
      id: 'session-recovery',
      trigger: (m) =>
        m.session.engagementTrend === 'rising' &&
        m.engagementScore > 65 &&
        m.session.elapsedMs > 300000,
      message: "Engagement is recovering nicely — whatever you changed is working!",
      icon: '📈',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
    // NEW: Enhanced distraction and expression-based nudges
    {
      id: 'high-blink-rate',
      trigger: (m) => (m.student.blinkRate ?? 0) > 25 && m.session.elapsedMs > 300000,
      message: "Student's blink rate is elevated — this may indicate fatigue or stress. Consider a short break.",
      icon: '😫',
      priority: 'low',
      cooldownMs: 300000,
      sensitivity: 'high',
    },
    {
      id: 'student-fidgeting',
      trigger: (m) => (m.student.headMovement ?? 0) > 0.6 && m.session.elapsedMs > 180000,
      message: "Student appears restless — try an interactive activity or movement break",
      icon: '🫨',
      priority: 'medium',
      cooldownMs: 240000,
      sensitivity: 'medium',
    },
    {
      id: 'high-distraction',
      trigger: (m) => (m.student.distractionScore ?? 0) > 0.7 && m.session.elapsedMs > 120000,
      message: "High distraction detected — try refocusing with a direct question or visual aid",
      icon: '🎯',
      priority: 'high',
      cooldownMs: 120000,
      sensitivity: 'medium',
    },
    {
      id: 'student-frustration',
      trigger: (m) => {
        const expr = m.studentExpression;
        return expr !== null && (expr.frustration ?? 0) > 0.5 && m.session.elapsedMs > 120000;
      },
      message: "Student may be frustrated — acknowledge the difficulty and offer a different approach",
      icon: '😤',
      priority: 'high',
      cooldownMs: 180000,
      sensitivity: 'medium',
    },
    {
      id: 'student-high-interest',
      trigger: (m) => {
        const expr = m.studentExpression;
        return expr !== null && (expr.interest ?? 0) > 0.7 && m.engagementScore > 80 && m.session.elapsedMs > 300000;
      },
      message: "Student is showing high interest — great time to introduce a new challenging concept!",
      icon: '🔥',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
    {
      id: 'focus-streak-celebration',
      trigger: (m) => (m.session.focusStreakMs ?? 0) > 600000 && m.engagementScore > 70,
      message: "10+ minute focus streak! The student is deeply engaged — keep this flow going",
      icon: '🏆',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
    {
      id: 'slouching-detected',
      trigger: (m) => m.student.posture === 'slouching' && m.session.elapsedMs > 300000,
      message: "Student's posture suggests low energy — a quick stretch or change of activity might help",
      icon: '🧘',
      priority: 'low',
      cooldownMs: 600000,
      sensitivity: 'high',
    },
  ];
}

// Keep backward compatibility
export const DEFAULT_NUDGE_RULES = createNudgeRules('discussion');
