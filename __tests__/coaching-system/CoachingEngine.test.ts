import { CoachingEngine } from '@/lib/coaching-system/CoachingEngine';
import { MetricSnapshot, ParticipantMetrics, SessionMetrics } from '@/lib/metrics-engine/types';

function makeSnapshot(overrides: Partial<{
  engagementScore: number;
  studentSilenceMs: number;
  studentEyeContact: number;
  studentEyeContactTrend: 'rising' | 'stable' | 'declining';
  tutorTalkPercent: number;
  studentEnergy: number;
  interruptionCount: number;
  attentionDrift: boolean;
  elapsedMs: number;
  timestamp: number;
}> = {}): MetricSnapshot {
  const tutor: ParticipantMetrics = {
    eyeContactScore: 0.7,
    talkTimePercent: overrides.tutorTalkPercent ?? 0.5,
    energyScore: 0.6,
    isSpeaking: false,
    silenceDurationMs: 0,
    eyeContactTrend: 'stable',
    pitchVariance: 0.1,
    speechRate: 0.3,
  };
  const student: ParticipantMetrics = {
    eyeContactScore: overrides.studentEyeContact ?? 0.6,
    talkTimePercent: 1 - (overrides.tutorTalkPercent ?? 0.5),
    energyScore: overrides.studentEnergy ?? 0.6,
    isSpeaking: false,
    silenceDurationMs: overrides.studentSilenceMs ?? 0,
    eyeContactTrend: overrides.studentEyeContactTrend ?? 'stable',
    pitchVariance: 0.1,
    speechRate: 0.3,
  };
  const session: SessionMetrics = {
    interruptionCount: overrides.interruptionCount ?? 0,
    silenceDurationCurrent: 0,
    engagementTrend: 'stable',
    attentionDriftDetected: overrides.attentionDrift ?? false,
    elapsedMs: overrides.elapsedMs ?? 600000,
    turnTakingGapMs: 1500,
    turnCount: 8,
    studentState: 'engaged',
  };
  return {
    timestamp: overrides.timestamp ?? Date.now(),
    tutor,
    student,
    session,
    engagementScore: overrides.engagementScore ?? 70,
    studentState: 'engaged',
    tutorExpression: null,
    studentExpression: null,
  };
}

describe('CoachingEngine', () => {
  it('returns no nudges at low sensitivity with neutral metrics', () => {
    const engine = new CoachingEngine({ sensitivity: 'low', minIntervalMs: 0 });
    const nudges = engine.evaluate(makeSnapshot());
    // At low sensitivity, only critical nudges fire — neutral metrics shouldn't trigger any
    expect(nudges.length).toBe(0);
  });

  it('triggers student-silent nudge after 3 minutes silence', () => {
    const engine = new CoachingEngine({ minIntervalMs: 0 });
    const nudges = engine.evaluate(makeSnapshot({ studentSilenceMs: 200000 }));
    const silentNudge = nudges.find(n => n.ruleId === 'student-silent-long');
    expect(silentNudge).toBeDefined();
    expect(silentNudge!.message).toContain("hasn't spoken");
  });

  it('triggers attention-drift nudge', () => {
    const engine = new CoachingEngine({ minIntervalMs: 0 });
    const nudges = engine.evaluate(makeSnapshot({ attentionDrift: true }));
    const driftNudge = nudges.find(n => n.ruleId === 'attention-drift');
    expect(driftNudge).toBeDefined();
  });

  it('triggers tutor-dominating nudge when >80% talk time after 5 min', () => {
    const engine = new CoachingEngine({ minIntervalMs: 0 });
    const nudges = engine.evaluate(makeSnapshot({
      tutorTalkPercent: 0.85,
      elapsedMs: 400000,
    }));
    const dominatingNudge = nudges.find(n => n.ruleId === 'tutor-dominating');
    expect(dominatingNudge).toBeDefined();
  });

  it('respects disabled rules', () => {
    const engine = new CoachingEngine({
      minIntervalMs: 0,
      disabledRules: ['student-silent-long'],
    });
    const nudges = engine.evaluate(makeSnapshot({ studentSilenceMs: 200000 }));
    expect(nudges.find(n => n.ruleId === 'student-silent-long')).toBeUndefined();
  });

  it('returns no nudges when disabled', () => {
    const engine = new CoachingEngine({ enabled: false });
    const nudges = engine.evaluate(makeSnapshot({ studentSilenceMs: 999999 }));
    expect(nudges).toEqual([]);
  });

  it('triggers great-engagement nudge at high sensitivity', () => {
    const engine = new CoachingEngine({ minIntervalMs: 0, sensitivity: 'high' });
    const nudges = engine.evaluate(makeSnapshot({ engagementScore: 90 }));
    const greatNudge = nudges.find(n => n.ruleId === 'great-engagement');
    expect(greatNudge).toBeDefined();
  });

  it('does not trigger high-sensitivity rules at low sensitivity', () => {
    const engine = new CoachingEngine({ minIntervalMs: 0, sensitivity: 'low' });
    const nudges = engine.evaluate(makeSnapshot({ engagementScore: 90 }));
    expect(nudges.find(n => n.ruleId === 'great-engagement')).toBeUndefined();
  });
});
