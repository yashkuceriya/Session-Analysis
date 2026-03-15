import { InterruptionDetector } from '@/lib/audio-processor/InterruptionDetector';

describe('InterruptionDetector', () => {
  let detector: InterruptionDetector;

  beforeEach(() => {
    detector = new InterruptionDetector();
  });

  it('starts with zero interruptions', () => {
    expect(detector.getCount()).toBe(0);
    expect(detector.getAll()).toEqual([]);
  });

  it('does not count sequential speaking as interruption', () => {
    detector.update(true, false, 0);
    detector.update(true, false, 500);
    detector.update(false, true, 1000);
    detector.update(false, true, 1500);
    expect(detector.getCount()).toBe(0);
  });

  it('counts overlapping speech >500ms as interruption', () => {
    // Tutor starts speaking
    detector.update(true, false, 0);
    detector.update(true, false, 200);
    // Student starts while tutor is speaking (overlap begins)
    detector.update(true, true, 400);
    detector.update(true, true, 600);
    detector.update(true, true, 800);
    detector.update(true, true, 1000);
    // Overlap ends (600ms overlap)
    detector.update(false, true, 1100);

    expect(detector.getCount()).toBe(1);
    const interruptions = detector.getAll();
    expect(interruptions[0].interruptedBy).toBe('student');
  });

  it('ignores brief overlaps <500ms', () => {
    detector.update(true, false, 0);
    detector.update(true, true, 100);
    detector.update(true, true, 300);
    detector.update(true, false, 500); // Only 400ms overlap
    expect(detector.getCount()).toBe(0);
  });

  it('tracks recent interruptions within a window', () => {
    detector.update(true, false, 0);
    detector.update(true, true, 100);
    detector.update(true, true, 700);
    detector.update(false, true, 800);

    const recent = detector.getRecent(5000, 1000);
    expect(recent.length).toBe(1);

    const old = detector.getRecent(50, 10000);
    expect(old.length).toBe(0);
  });

  it('resets all state', () => {
    detector.update(true, false, 0);
    detector.update(true, true, 100);
    detector.update(true, true, 700);
    detector.update(false, true, 800);

    detector.reset();
    expect(detector.getCount()).toBe(0);
  });
});
