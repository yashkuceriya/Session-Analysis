import { InterruptionDetector } from '@/lib/audio-processor/InterruptionDetector';

// The detector now has:
// - 300ms debounce-on (must speak for 300ms to count)
// - 500ms debounce-off (must be silent for 500ms to count as stopped)
// - 1500ms overlap threshold (overlap must last 1500ms)
// - 3000ms min gap between interruptions

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
    // Tutor speaks for 1s, then student speaks for 1s — no overlap
    for (let t = 0; t <= 1000; t += 100) detector.update(true, false, t);
    for (let t = 1500; t <= 2500; t += 100) detector.update(false, true, t);
    expect(detector.getCount()).toBe(0);
  });

  it('counts sustained overlapping speech as interruption', () => {
    // Tutor starts speaking (needs 300ms debounce)
    for (let t = 0; t <= 500; t += 100) detector.update(true, false, t);
    // Student joins (both speaking) — overlap starts after student debounce
    for (let t = 600; t <= 3000; t += 100) detector.update(true, true, t);
    // Student stops — overlap ends after 2400ms (> 1500ms threshold)
    for (let t = 3100; t <= 4000; t += 100) detector.update(true, false, t);

    expect(detector.getCount()).toBeGreaterThanOrEqual(1);
  });

  it('ignores brief overlaps under threshold', () => {
    // Tutor speaks
    for (let t = 0; t <= 500; t += 100) detector.update(true, false, t);
    // Brief overlap (500ms — under 1500ms threshold)
    for (let t = 600; t <= 1100; t += 100) detector.update(true, true, t);
    // Student stops
    for (let t = 1200; t <= 2000; t += 100) detector.update(true, false, t);

    expect(detector.getCount()).toBe(0);
  });

  it('resets all state', () => {
    for (let t = 0; t <= 500; t += 100) detector.update(true, false, t);
    for (let t = 600; t <= 3000; t += 100) detector.update(true, true, t);
    for (let t = 3100; t <= 4000; t += 100) detector.update(true, false, t);

    detector.reset();
    expect(detector.getCount()).toBe(0);
    expect(detector.getAll()).toEqual([]);
  });
});
