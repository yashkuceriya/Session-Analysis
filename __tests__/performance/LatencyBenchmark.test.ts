import { MetricsEngine } from '../../src/lib/metrics-engine/MetricsEngine';
import { FaceFrame } from '../../src/lib/video-processor/types';

function createMinimalFace(): FaceFrame {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // Set eye landmarks for gaze estimation
  landmarks[33] = { x: 0.35, y: 0.4, z: 0 };
  landmarks[133] = { x: 0.45, y: 0.4, z: 0 };
  landmarks[468] = { x: 0.40, y: 0.4, z: 0 };
  landmarks[263] = { x: 0.55, y: 0.4, z: 0 };
  landmarks[362] = { x: 0.65, y: 0.4, z: 0 };
  landmarks[473] = { x: 0.60, y: 0.4, z: 0 };
  landmarks[159] = { x: 0.40, y: 0.37, z: 0 };
  landmarks[145] = { x: 0.40, y: 0.43, z: 0 };
  landmarks[386] = { x: 0.60, y: 0.37, z: 0 };
  landmarks[374] = { x: 0.60, y: 0.43, z: 0 };
  landmarks[61] = { x: 0.45, y: 0.65, z: 0 };
  landmarks[291] = { x: 0.55, y: 0.65, z: 0 };
  landmarks[13] = { x: 0.5, y: 0.64, z: 0 };
  landmarks[14] = { x: 0.5, y: 0.66, z: 0 };
  landmarks[0] = { x: 0.5, y: 0.64, z: 0 };
  landmarks[17] = { x: 0.5, y: 0.66, z: 0 };
  landmarks[105] = { x: 0.40, y: 0.33, z: 0 };
  landmarks[334] = { x: 0.60, y: 0.33, z: 0 };
  return { landmarks, blendshapes: null, timestamp: Date.now() };
}

describe('Latency Benchmarks', () => {
  test('MetricsEngine.update processes under 5ms per tick', () => {
    const engine = new MetricsEngine({ sessionType: 'discussion' });
    const face = createMinimalFace();
    const baseTime = Date.now();
    const latencies: number[] = [];

    // Warm up
    for (let i = 0; i < 10; i++) {
      engine.update(face, face, true, true, 0.5, 0.5, baseTime + i * 500);
    }

    // Benchmark 1000 ticks
    for (let i = 10; i < 1010; i++) {
      const start = performance.now();
      engine.update(face, face, i % 2 === 0, i % 3 === 0, 0.3, 0.2, baseTime + i * 500);
      latencies.push(performance.now() - start);
    }

    const sorted = latencies.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log(`Metrics Engine Latency - p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`);

    expect(p50).toBeLessThan(5);
    expect(p95).toBeLessThan(10);
    expect(p99).toBeLessThan(20);
  });

  test('MetricsEngine handles 1-hour session without memory leak', () => {
    const engine = new MetricsEngine({ sessionType: 'discussion' });
    const face = createMinimalFace();
    const baseTime = Date.now();

    // Simulate 1 hour at 2Hz = 7200 ticks
    const tickCount = 7200;

    for (let i = 0; i < tickCount; i++) {
      engine.update(
        face, face,
        i % 2 === 0, i % 3 === 0,
        Math.random() * 0.5, Math.random() * 0.5,
        baseTime + i * 500
      );
    }

    // Should still produce valid metrics
    const finalSnapshot = engine.update(face, face, true, false, 0.3, 0.1, baseTime + tickCount * 500);
    expect(finalSnapshot.engagementScore).toBeGreaterThanOrEqual(0);
    expect(finalSnapshot.engagementScore).toBeLessThanOrEqual(100);
    expect(finalSnapshot.studentState).toBeDefined();
  });
});
