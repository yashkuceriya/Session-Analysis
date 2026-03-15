export class LatencyTracker {
  private measurements: number[] = [];
  private maxMeasurements = 100;

  startMeasure(): () => number {
    const start = performance.now();
    return () => {
      const elapsed = performance.now() - start;
      this.measurements.push(elapsed);
      if (this.measurements.length > this.maxMeasurements) {
        this.measurements.shift();
      }
      return elapsed;
    };
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
  }

  getP95(): number {
    if (this.measurements.length === 0) return 0;
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx];
  }

  getLast(): number {
    return this.measurements[this.measurements.length - 1] ?? 0;
  }

  reset() {
    this.measurements = [];
  }
}
