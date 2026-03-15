import { distance2D, distance3D, midpoint, irisOffsetRatio } from '@/lib/utils/geometry';

describe('distance2D', () => {
  it('returns 0 for same point', () => {
    const p = { x: 1, y: 2, z: 0 };
    expect(distance2D(p, p)).toBe(0);
  });

  it('computes correct distance', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 3, y: 4, z: 0 };
    expect(distance2D(a, b)).toBe(5);
  });
});

describe('distance3D', () => {
  it('includes z dimension', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 1, y: 2, z: 2 };
    expect(distance3D(a, b)).toBe(3);
  });
});

describe('midpoint', () => {
  it('returns midpoint of two landmarks', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 20, z: 6 };
    const m = midpoint(a, b);
    expect(m).toEqual({ x: 5, y: 10, z: 3 });
  });
});

describe('irisOffsetRatio', () => {
  it('returns 0.5 when iris is centered', () => {
    const inner = { x: 0, y: 0, z: 0 };
    const outer = { x: 1, y: 0, z: 0 };
    const iris = { x: 0.5, y: 0, z: 0 };
    const ratio = irisOffsetRatio(iris, inner, outer);
    expect(ratio.x).toBeCloseTo(0.5);
  });

  it('returns ~0 when iris is at inner corner', () => {
    const inner = { x: 0, y: 0, z: 0 };
    const outer = { x: 1, y: 0, z: 0 };
    const iris = { x: 0.05, y: 0, z: 0 };
    const ratio = irisOffsetRatio(iris, inner, outer);
    expect(ratio.x).toBeCloseTo(0.05);
  });

  it('returns 0.5,0.5 for zero-width eye', () => {
    const p = { x: 0.5, y: 0.5, z: 0 };
    const ratio = irisOffsetRatio(p, p, p);
    expect(ratio.x).toBe(0.5);
    expect(ratio.y).toBe(0.5);
  });
});
