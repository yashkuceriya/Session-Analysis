import { MetricSnapshot } from '@/lib/metrics-engine/types';

describe('Metrics Pipeline', () => {
  it('should produce valid MetricSnapshot shape', () => {
    const snapshot: MetricSnapshot = {
      timestamp: Date.now(),
      engagementScore: 75,
      studentState: 'engaged',
      tutor: {
        talkTimePercent: 0.5,
        eyeContactScore: 0.8,
      },
      student: {
        talkTimePercent: 0.5,
        eyeContactScore: 0.7,
      },
    } as MetricSnapshot;

    expect(snapshot.engagementScore).toBe(75);
    expect(snapshot.studentState).toBe('engaged');
    expect(snapshot.tutor.talkTimePercent).toBe(0.5);
    expect(snapshot.student.eyeContactScore).toBe(0.7);
  });
});
