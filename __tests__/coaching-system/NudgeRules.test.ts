import { DEFAULT_NUDGE_RULES, createNudgeRules } from '@/lib/coaching-system/NudgeRules';
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
  studentState?: string;
  turnCount?: number;
}): MetricSnapshot {
  const tutor: ParticipantMetrics = {
    eyeContactScore: 0.7,
    talkTimePercent: overrides.tutorTalkPercent ?? 0.5,
    energyScore: 0.6,
    isSpeaking: false,
    silenceDurationMs: 0,
    eyeContactTrend: 'stable',
    pitchVariance: 0,
    speechRate: 0.3,
  };
  const student: ParticipantMetrics = {
    eyeContactScore: overrides.studentEyeContact ?? 0.6,
    talkTimePercent: 1 - (overrides.tutorTalkPercent ?? 0.5),
    energyScore: overrides.studentEnergy ?? 0.6,
    isSpeaking: false,
    silenceDurationMs: overrides.studentSilenceMs ?? 0,
    eyeContactTrend: overrides.studentEyeContactTrend ?? 'stable',
    pitchVariance: 0,
    speechRate: 0.3,
  };
  const session: SessionMetrics = {
    interruptionCount: overrides.interruptionCount ?? 0,
    silenceDurationCurrent: 0,
    engagementTrend: 'stable',
    attentionDriftDetected: overrides.attentionDrift ?? false,
    elapsedMs: overrides.elapsedMs ?? 600000,
    turnTakingGapMs: 1000,
    turnCount: overrides.turnCount ?? 5,
    studentState: (overrides.studentState as any) ?? 'engaged',
  };
  return {
    timestamp: Date.now(),
    tutor,
    student,
    session,
    engagementScore: overrides.engagementScore ?? 70,
    studentState: (overrides.studentState as any) ?? 'engaged',
    tutorExpression: null,
    studentExpression: null,
  };
}

describe('NudgeRules', () => {
  const rules = DEFAULT_NUDGE_RULES; // discussion type

  it('student-silent-long triggers above threshold', () => {
    const rule = rules.find(r => r.id === 'student-silent-long')!;
    expect(rule).toBeDefined();
    // Discussion threshold is 20000ms (20s)
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 25000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ studentSilenceMs: 5000 }))).toBe(false);
  });

  it('attention-drift triggers when detected', () => {
    const rule = rules.find(r => r.id === 'attention-drift')!;
    expect(rule).toBeDefined();
    expect(rule.trigger(makeSnapshot({ attentionDrift: true }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ attentionDrift: false }))).toBe(false);
  });

  it('great-engagement triggers at high score', () => {
    const rule = rules.find(r => r.id === 'great-engagement')!;
    expect(rule).toBeDefined();
    expect(rule.trigger(makeSnapshot({ engagementScore: 90, elapsedMs: 400000 }))).toBe(true);
    expect(rule.trigger(makeSnapshot({ engagementScore: 50, elapsedMs: 400000 }))).toBe(false);
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

  it('createNudgeRules produces rules for each session type', () => {
    const lectureRules = createNudgeRules('lecture');
    const practiceRules = createNudgeRules('practice');
    const discussionRules = createNudgeRules('discussion');
    expect(lectureRules.length).toBeGreaterThan(5);
    expect(practiceRules.length).toBeGreaterThan(5);
    expect(discussionRules.length).toBeGreaterThan(5);
  });
});
