import { SpeakingTimeTracker } from '@/lib/audio-processor/SpeakingTimeTracker';

describe('SpeakingTimeTracker', () => {
  let tracker: SpeakingTimeTracker;

  beforeEach(() => {
    tracker = new SpeakingTimeTracker();
  });

  it('returns 50/50 when no one has spoken', () => {
    const result = tracker.getResult();
    expect(result.tutor).toBe(0.5);
    expect(result.student).toBe(0.5);
  });

  it('tracks tutor-only speaking', () => {
    tracker.update(true, false, 100);
    tracker.update(true, false, 600);   // delta=500ms, lastTutor was true → tutor += 500
    tracker.update(false, false, 1100); // delta=500ms, lastTutor was true → tutor += 500
    const result = tracker.getResult();
    expect(result.tutor).toBe(1);
    expect(result.student).toBe(0);
    expect(result.tutorTotalMs).toBe(1000);
  });

  it('tracks balanced speaking', () => {
    tracker.update(true, false, 0);
    tracker.update(true, false, 500);
    tracker.update(false, true, 1000);
    tracker.update(false, true, 1500);
    tracker.update(false, false, 2000);
    const result = tracker.getResult();
    expect(result.tutor).toBeCloseTo(0.5, 1);
    expect(result.student).toBeCloseTo(0.5, 1);
  });

  it('resets all state', () => {
    tracker.update(true, false, 0);
    tracker.update(true, false, 5000);
    tracker.reset();
    const result = tracker.getResult();
    expect(result.tutorTotalMs).toBe(0);
    expect(result.studentTotalMs).toBe(0);
  });

  it('ignores large time jumps as sanity check', () => {
    tracker.update(true, false, 1000);
    tracker.update(true, false, 6000); // >2000ms gap, ignored
    const result = tracker.getResult();
    expect(result.tutorTotalMs).toBe(0);
  });
});
