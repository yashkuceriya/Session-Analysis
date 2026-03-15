import { SessionSummarizer } from '@/lib/reports/SessionSummarizer';
import { MetricSnapshot, StudentState } from '@/lib/metrics-engine/types';
import { Nudge } from '@/lib/coaching-system/types';
import { SessionConfig } from '@/lib/session/types';

// Helper factory to create test metric snapshots
function createMetricSnapshot(
  timestamp: number,
  engagementScore: number,
  studentState: StudentState,
  tutorTalkTime: number = 0.5,
  studentTalkTime: number = 0.5,
  tutorEyeContact: number = 0.7,
  studentEyeContact: number = 0.6
): MetricSnapshot {
  return {
    timestamp,
    tutor: {
      eyeContactScore: tutorEyeContact,
      talkTimePercent: tutorTalkTime,
      energyScore: 0.7,
      isSpeaking: tutorTalkTime > 0,
      silenceDurationMs: 0,
      eyeContactTrend: 'stable',
      pitchVariance: 0.3,
      speechRate: tutorTalkTime,
    },
    student: {
      eyeContactScore: studentEyeContact,
      talkTimePercent: studentTalkTime,
      energyScore: 0.6,
      isSpeaking: studentTalkTime > 0,
      silenceDurationMs: 0,
      eyeContactTrend: 'stable',
      pitchVariance: 0.2,
      speechRate: studentTalkTime,
    },
    session: {
      interruptionCount: 0,
      silenceDurationCurrent: 0,
      engagementTrend: 'stable',
      attentionDriftDetected: false,
      elapsedMs: 0,
      turnTakingGapMs: 0,
      turnCount: 0,
      studentState,
    },
    engagementScore,
    studentState,
  };
}

// Helper factory to create test nudges
function createNudge(
  timestamp: number,
  ruleId: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
): Nudge {
  return {
    id: `nudge-${timestamp}-${ruleId}`,
    timestamp,
    ruleId,
    message: `Test nudge: ${ruleId}`,
    icon: '💡',
    priority,
    dismissed: false,
    triggerMetrics: {
      engagementScore: 50,
    },
  };
}

describe('SessionSummarizer', () => {
  let summarizer: SessionSummarizer;
  let mockConfig: SessionConfig;

  beforeEach(() => {
    summarizer = new SessionSummarizer();
    mockConfig = {
      subject: 'Mathematics',
      sessionType: 'discussion',
      studentLevel: 'High School',
      tutorName: 'Tutor',
      studentName: 'Student',
    };
  });

  it('should generate summary with correct duration', () => {
    const startTime = 1000;
    const endTime = 61000; // 60 seconds
    const history = [
      createMetricSnapshot(startTime, 60, 'engaged'),
      createMetricSnapshot(endTime, 65, 'engaged'),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.duration).toBe(60000); // 60 seconds in ms
  });

  it('should calculate overall engagement as average', () => {
    const history = [
      createMetricSnapshot(1000, 50, 'engaged'),
      createMetricSnapshot(2000, 60, 'engaged'),
      createMetricSnapshot(3000, 70, 'engaged'),
      createMetricSnapshot(4000, 80, 'engaged'),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    // Average of 50, 60, 70, 80 = 65
    expect(summary.overallEngagement).toBe(65);
  });

  it('should identify engagement trend improving', () => {
    const history = [];
    // First half: low engagement (20-40)
    for (let i = 0; i < 5; i++) {
      history.push(createMetricSnapshot(1000 + i * 1000, 20 + i * 5, 'engaged'));
    }
    // Second half: high engagement (60-80)
    for (let i = 5; i < 10; i++) {
      history.push(createMetricSnapshot(1000 + i * 1000, 60 + (i - 5) * 5, 'engaged'));
    }

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.engagementTrend).toBe('improving');
  });

  it('should identify engagement trend declining', () => {
    const history = [];
    // First half: high engagement (70-90)
    for (let i = 0; i < 5; i++) {
      history.push(createMetricSnapshot(1000 + i * 1000, 90 - i * 5, 'engaged'));
    }
    // Second half: low engagement (30-50)
    for (let i = 5; i < 10; i++) {
      history.push(createMetricSnapshot(1000 + i * 1000, 50 - (i - 5) * 5, 'drifting'));
    }

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.engagementTrend).toBe('declining');
  });

  it('should identify engagement trend stable', () => {
    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push(createMetricSnapshot(1000 + i * 1000, 55 + (Math.random() - 0.5) * 4, 'engaged'));
    }

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.engagementTrend).toBe('stable');
  });

  it('should calculate student state breakdown percentages', () => {
    const history = [
      createMetricSnapshot(1000, 80, 'engaged'),
      createMetricSnapshot(2000, 75, 'engaged'),
      createMetricSnapshot(3000, 50, 'passive'),
      createMetricSnapshot(4000, 45, 'confused'),
      createMetricSnapshot(5000, 30, 'drifting'),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.studentStateBreakdown.engaged).toBe(40); // 2/5 = 40%
    expect(summary.studentStateBreakdown.passive).toBe(20); // 1/5 = 20%
    expect(summary.studentStateBreakdown.confused).toBe(20); // 1/5 = 20%
    expect(summary.studentStateBreakdown.drifting).toBe(20); // 1/5 = 20%
    expect(summary.studentStateBreakdown.struggling).toBe(0); // 0/5 = 0%
  });

  it('should calculate talk time ratio correctly', () => {
    const history = [
      createMetricSnapshot(1000, 60, 'engaged', 0.75, 0.25), // Tutor 75%, student 25%
      createMetricSnapshot(2000, 65, 'engaged', 0.75, 0.25),
      createMetricSnapshot(3000, 70, 'engaged', 0.75, 0.25),
      createMetricSnapshot(4000, 68, 'engaged', 0.75, 0.25),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.talkTimeRatio.tutor).toBeCloseTo(0.75, 2);
    expect(summary.talkTimeRatio.student).toBeCloseTo(0.25, 2);
  });

  it('should calculate eye contact averages', () => {
    const history = [
      createMetricSnapshot(1000, 60, 'engaged', 0.5, 0.5, 0.8, 0.6),
      createMetricSnapshot(2000, 65, 'engaged', 0.5, 0.5, 0.7, 0.5),
      createMetricSnapshot(3000, 70, 'engaged', 0.5, 0.5, 0.6, 0.4),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.eyeContactAvg.tutor).toBeCloseTo(0.7, 1); // (0.8 + 0.7 + 0.6) / 3
    expect(summary.eyeContactAvg.student).toBeCloseTo(0.5, 1); // (0.6 + 0.5 + 0.4) / 3
  });

  it('should identify key moments (peaks and valleys)', () => {
    const history = [
      createMetricSnapshot(1000, 30, 'drifting'),
      createMetricSnapshot(2000, 90, 'engaged'),
      createMetricSnapshot(3000, 85, 'engaged'),
      createMetricSnapshot(4000, 20, 'struggling'),
      createMetricSnapshot(5000, 70, 'passive'),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.keyMoments.length).toBeGreaterThan(0);
    // Should include peak moments (90, 85) and valley moments (30, 20)
    const peaks = summary.keyMoments.filter((m) => m.type === 'peak');
    const valleys = summary.keyMoments.filter((m) => m.type === 'valley');
    expect(peaks.length).toBeGreaterThan(0);
    expect(valleys.length).toBeGreaterThan(0);
  });

  it('should generate strengths and improvement areas', () => {
    const history = [
      createMetricSnapshot(1000, 85, 'engaged', 0.5, 0.5, 0.8, 0.75),
      createMetricSnapshot(2000, 90, 'engaged', 0.5, 0.5, 0.8, 0.75),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.strengths.length).toBeGreaterThan(0);
    expect(Array.isArray(summary.areasForImprovement)).toBe(true);
  });

  it('should summarize nudges by priority', () => {
    const nudges = [
      createNudge(1000, 'rule-1', 'high'),
      createNudge(2000, 'rule-2', 'high'),
      createNudge(3000, 'rule-3', 'medium'),
      createNudge(4000, 'rule-4', 'low'),
    ];

    const history = [createMetricSnapshot(1000, 60, 'engaged')];

    const summary = summarizer.summarize(history, nudges, mockConfig);

    expect(summary.nudgesSummary.total).toBe(4);
    expect(summary.nudgesSummary.byPriority.high).toBe(2);
    expect(summary.nudgesSummary.byPriority.medium).toBe(1);
    expect(summary.nudgesSummary.byPriority.low).toBe(1);
  });

  it('should handle empty history gracefully', () => {
    const summary = summarizer.summarize([], [], mockConfig);

    expect(summary.duration).toBe(0);
    expect(summary.overallEngagement).toBe(0);
    expect(summary.engagementTrend).toBe('stable');
    expect(summary.keyMoments.length).toBe(0);
    expect(summary.studentStateBreakdown.engaged).toBe(0);
    expect(summary.talkTimeRatio.tutor).toBeCloseTo(0.5, 1);
  });

  it('should handle single snapshot in history', () => {
    const history = [createMetricSnapshot(1000, 65, 'engaged')];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.duration).toBe(0); // Single snapshot, no duration
    expect(summary.overallEngagement).toBe(65);
    expect(summary.studentStateBreakdown.engaged).toBe(100);
  });

  it('should return max 5 key moments', () => {
    const history = [];
    for (let i = 0; i < 50; i++) {
      history.push(createMetricSnapshot(1000 + i * 100, 50 + Math.random() * 30, 'engaged'));
    }

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.keyMoments.length).toBeLessThanOrEqual(5);
  });

  it('should identify most frequent nudge', () => {
    const nudges = [
      createNudge(1000, 'student-silent-long'),
      createNudge(2000, 'student-silent-long'),
      createNudge(3000, 'student-silent-long'),
      createNudge(4000, 'tutor-dominating'),
    ];

    const history = [createMetricSnapshot(1000, 60, 'engaged')];

    const summary = summarizer.summarize(history, nudges, mockConfig);

    // The most frequent message should contain student-silent-long
    expect(summary.nudgesSummary.mostFrequent).toContain('student-silent-long');
  });

  it('should reflect high engagement strength', () => {
    const history = [
      createMetricSnapshot(1000, 85, 'engaged', 0.5, 0.5, 0.75, 0.75),
      createMetricSnapshot(2000, 88, 'engaged', 0.5, 0.5, 0.78, 0.76),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.strengths.some((s) => s.includes('engagement'))).toBe(true);
  });

  it('should identify low engagement recommendations', () => {
    const history = [
      createMetricSnapshot(1000, 35, 'passive'),
      createMetricSnapshot(2000, 38, 'confused'),
    ];

    const summary = summarizer.summarize(history, [], mockConfig);

    expect(summary.recommendations.length).toBeGreaterThan(0);
  });
});
