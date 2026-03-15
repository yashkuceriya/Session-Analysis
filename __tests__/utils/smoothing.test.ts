import { EMA, RollingWindow, clamp, detectTrend } from '@/lib/utils/smoothing';

describe('EMA', () => {
  it('returns the first value on initial update', () => {
    const ema = new EMA(0.3);
    expect(ema.update(10)).toBe(10);
  });

  it('smooths values toward the new input', () => {
    const ema = new EMA(0.5);
    ema.update(0);
    const result = ema.update(10);
    expect(result).toBe(5); // 0.5 * 10 + 0.5 * 0
  });

  it('converges to a steady input', () => {
    const ema = new EMA(0.3);
    for (let i = 0; i < 50; i++) ema.update(100);
    expect(ema.get()).toBeCloseTo(100, 1);
  });

  it('resets to null state', () => {
    const ema = new EMA(0.3);
    ema.update(50);
    ema.reset();
    expect(ema.get()).toBe(0);
    expect(ema.update(20)).toBe(20);
  });
});

describe('RollingWindow', () => {
  it('stores items up to max size', () => {
    const w = new RollingWindow<number>(3);
    w.push(1); w.push(2); w.push(3); w.push(4);
    expect(w.getAll()).toEqual([2, 3, 4]);
    expect(w.length).toBe(3);
  });

  it('computes average correctly', () => {
    const w = new RollingWindow<number>(5);
    [10, 20, 30].forEach(v => w.push(v));
    expect(w.average(v => v)).toBe(20);
  });

  it('computes ratio correctly', () => {
    const w = new RollingWindow<boolean>(4);
    [true, true, false, false].forEach(v => w.push(v));
    expect(w.ratio(v => v)).toBe(0.5);
  });

  it('returns 0 for empty window average', () => {
    const w = new RollingWindow<number>(5);
    expect(w.average(v => v)).toBe(0);
  });

  it('clears all items', () => {
    const w = new RollingWindow<number>(5);
    w.push(1); w.push(2);
    w.clear();
    expect(w.length).toBe(0);
    expect(w.getAll()).toEqual([]);
  });
});

describe('clamp', () => {
  it('clamps below minimum', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps above maximum', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('passes through values in range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe('detectTrend', () => {
  it('detects rising trend', () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    expect(detectTrend(values)).toBe('rising');
  });

  it('detects declining trend', () => {
    const values = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
    expect(detectTrend(values)).toBe('declining');
  });

  it('detects stable trend', () => {
    const values = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    expect(detectTrend(values)).toBe('stable');
  });

  it('returns stable for insufficient data', () => {
    expect(detectTrend([0.1, 0.2])).toBe('stable');
  });
});
