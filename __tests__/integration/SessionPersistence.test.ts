import { MetricSnapshot, StudentState } from '@/lib/metrics-engine/types';

function createMockSnapshot(timestamp: number, engagement: number): MetricSnapshot {
  return {
    timestamp,
    tutor: {
      eyeContactScore: 0.7,
      talkTimePercent: 0.5,
      energyScore: 0.6,
      isSpeaking: false,
      silenceDurationMs: 0,
      eyeContactTrend: 'stable' as const,
      pitchVariance: 0.3,
      speechRate: 0.4,
    },
    student: {
      eyeContactScore: 0.6,
      talkTimePercent: 0.5,
      energyScore: 0.5,
      isSpeaking: false,
      silenceDurationMs: 0,
      eyeContactTrend: 'stable' as const,
      pitchVariance: 0.2,
      speechRate: 0.3,
    },
    session: {
      interruptionCount: 0,
      silenceDurationCurrent: 0,
      engagementTrend: 'stable' as const,
      attentionDriftDetected: false,
      elapsedMs: timestamp,
      turnTakingGapMs: 1000,
      turnCount: 5,
      studentState: 'engaged' as StudentState,
    },
    engagementScore: engagement,
    studentState: 'engaged' as StudentState,
    tutorExpression: null,
    studentExpression: null,
  };
}

describe('Session Persistence Data Model', () => {
  it('should create valid metric snapshots with all required fields', () => {
    const snapshot = createMockSnapshot(1000, 75);

    expect(snapshot.timestamp).toBe(1000);
    expect(snapshot.engagementScore).toBe(75);
    expect(snapshot.studentState).toBe('engaged');
    expect(snapshot.tutor.eyeContactScore).toBe(0.7);
    expect(snapshot.student.eyeContactScore).toBe(0.6);
    expect(snapshot.session.interruptionCount).toBe(0);
  });

  it('should aggregate multiple snapshots correctly', () => {
    const snapshots = [
      createMockSnapshot(1000, 72),
      createMockSnapshot(2000, 68),
      createMockSnapshot(3000, 75),
    ];

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0].engagementScore).toBe(72);
    expect(snapshots[1].engagementScore).toBe(68);
    expect(snapshots[2].engagementScore).toBe(75);

    const avgEngagement = snapshots.reduce((sum, s) => sum + s.engagementScore, 0) / snapshots.length;
    expect(avgEngagement).toBeCloseTo(71.67, 1);
  });

  it('should preserve tutor and student metrics separately', () => {
    const snapshot = createMockSnapshot(5000, 80);

    expect(snapshot.tutor.eyeContactScore).not.toEqual(snapshot.student.eyeContactScore);
    expect(snapshot.tutor.talkTimePercent).toBe(0.5);
    expect(snapshot.student.talkTimePercent).toBe(0.5);
  });

  it('should track session metadata correctly', () => {
    const snapshot = createMockSnapshot(10000, 65);

    expect(snapshot.session.turnCount).toBe(5);
    expect(snapshot.session.interruptionCount).toBe(0);
    expect(snapshot.session.attentionDriftDetected).toBe(false);
    expect(snapshot.session.elapsedMs).toBe(10000);
  });

  it('should support all student states', () => {
    const states: StudentState[] = ['engaged', 'passive', 'confused', 'drifting', 'struggling'];

    states.forEach((state) => {
      const snapshot: MetricSnapshot = {
        ...createMockSnapshot(1000, 70),
        studentState: state,
      };
      expect(snapshot.studentState).toBe(state);
    });
  });
});
