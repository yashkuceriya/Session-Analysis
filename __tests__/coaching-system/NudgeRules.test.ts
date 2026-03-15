import { DEFAULT_NUDGE_RULES } from '@/lib/coaching-system/NudgeRules';
import { MetricSnapshot, ParticipantMetrics, SessionMetrics } from '@/lib/metrics-engine/types';

function makeSnapshot(overrides: {
  studentSilenceMs?: number;
  studentEyeContact?: number;
  studentEyeContactTrend?: 'rising' | 'stable' | 'declining';
  tutorTalkPercent?: number;
  studentEnergy?: number;
  interruptionCount?: number;
  attentionDrift?: boolean;
  elapsedMs?: number;
  engagementScore?: number;
}): MetricSnapshot {
  const tutor: ParticipantMetrics = {
    eyeContactScore: 0.7,
    talkTimePercent: overrides.tutorTalkPercent ?? 0.5,
    energyScore: 0.6,
    isSpeaking: false,
    silenceDurationMs: 0,
    eyeContactTrend: 'stable',
    pitchVariance: 0,
    speechRate: 0,
  };
  const student: ParticipantMetrics = {
    eyeContactScore: overrides.studentEyeContact ?? 0.6,
    talkTimePercent: 1 - (overrides.tutorTalkPercent ?? 0.5),
    energyScore: overrides.studentEnergy ?? 0.6,
    isSpeaking: false,
    silenceDurationMs: overrides.studentSilenceMs ?? 0,
    eyeContactTrend: overrides.studentEyeContactTrend ?? 'stable',
    pitchVariance: 0,
    speechRate: 0,
  };
  const session: SessionMetrics = {
    interruptionCount: overrides.interruptionCount ?? 0,
    silenceDurationCurrent: 0,
    engagementTrend: 'stable',
    attentionDriftDetected: overrides.attentionDrift ?? false,
    elapsedMs: overrides.elapsedMs ?? 600000,
    turnTakingGapMs: 0,
    turnCount: 0,
    studentState: 'engaged',
  };
  return {
    timestamp: Date.now(),
    tutor,
    student,
    session,
    engagementScore: overrides.engagementScore ?? 70,
    studentState: 'engaged',
  };
}

describe('NudgeRules', () => {
  const rules = DEFAULT_NUDGE_RULES;

  it('student-silent-long triggers at 3 min silence', () => {
    const rule = rules.find(r => r.id === 'student-silent-long')!;
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 190000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 100000 }))).toBe(false);
  });

  it('student-silent-critical triggers at 5 min silence', () => {
    const rule = rules.find(r => r.id === 'student-silent-critical')!;
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 310000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 290000 }))).toBe(false);
  });

  it('low-student-eye-contact requires both low score AND declining trend', () => {
    const rule = rules.find(r => r.id === 'low-student-eye-contact')!;
    // Low + declining: triggers
    expect(rule.trigger(makeSnapshot({
      studentEyeContact: 0.2,
      studentEyeContactTrend: 'declining',
    }))).toBe(true);
    // Low + stable: does not trigger
    expect(rule.trigger(makeSnapshot({
      studentEyeContact: 0.2,
      studentEyeContactTrend: 'stable',
    }))).toBe(false);
    // High + declining: does not trigger
    expect(rule.trigger(makeSnapshot({
      studentEyeContact: 0.8,
      studentEyeContactTrend: 'declining',
    }))).toBe(false);
  });

  it('tutor-dominating needs >80% talk AND >5 min elapsed', () => {
    const rule = rules.find(r => r.id === 'tutor-dominating')!;
    expect(rule.trigger(makeSnapshot({ tutorTalkPercent: 0.85, elapsedMs: 400000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ tutorTalkPercent: 0.85, elapsedMs: 100000 }))).toBe(false);
    expect(rule.trigger(makeSnapshot({ tutorTalkPercent: 0.60, elapsedMs: 400000 }))).toBe(false);
  });

  it('energy-drop needs low energy AND >10 min elapsed', () => {
    const rule = rules.find(r => r.id === 'energy-drop')!;
    expect(rule.trigger(makeSnapshot({ studentEnergy: 0.1, elapsedMs: 700000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ studentEnergy: 0.1, elapsedMs: 300000 }))).toBe(false);
  });

  it('great-engagement triggers at score >85', () => {
    const rule = rules.find(r => r.id === 'great-engagement')!;
    expect(rule.trigger(makeSnapshot({ engagementScore: 90 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ engagementScore: 70 }))).toBe(false);
  });

  it('all rules have required fields', () => {
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(rule.message).toBeTruthy();
      expect(rule.icon).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(rule.priority);
      expect(['low', 'medium', 'high']).toContain(rule.sensitivity);
      expect(rule.cooldownMs).toBeGreaterThan(0);
      expect(typeof rule.trigger).toBe('function');
    }
  });
});
