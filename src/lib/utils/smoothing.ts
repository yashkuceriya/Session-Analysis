export class EMA {
  private value: number | null = null;
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  update(newValue: number): number {
    if (this.value === null) {
      this.value = newValue;
    } else {
      this.value = this.alpha * newValue + (1 - this.alpha) * this.value;
    }
    return this.value;
  }

  get(): number {
    return this.value ?? 0;
  }

  reset() {
    this.value = null;
  }
}

export class RollingWindow<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T) {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  get length(): number {
    return this.buffer.length;
  }

  clear() {
    this.buffer = [];
  }

  average(fn: (item: T) => number): number {
    if (this.buffer.length === 0) return 0;
    const sum = this.buffer.reduce((acc, item) => acc + fn(item), 0);
    return sum / this.buffer.length;
  }

  countWhere(fn: (item: T) => boolean): number {
    return this.buffer.filter(fn).length;
  }

  ratio(fn: (item: T) => boolean): number {
    if (this.buffer.length === 0) return 0;
    return this.countWhere(fn) / this.buffer.length;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function detectTrend(values: number[], windowSize: number = 10): 'rising' | 'stable' | 'declining' {
  if (values.length < windowSize) return 'stable';
  const recent = values.slice(-windowSize);
  const firstHalf = recent.slice(0, Math.floor(windowSize / 2));
  const secondHalf = recent.slice(Math.floor(windowSize / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;
  if (diff > 0.05) return 'rising';
  if (diff < -0.05) return 'declining';
  return 'stable';
}
