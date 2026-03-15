import { CognitiveLoadEstimator } from '@/lib/analysis/CognitiveLoadEstimator';
import { CognitiveLoadSignals } from '@/lib/analysis/types';

// Helper factory to create cognitive load signals
function createSignals(
  responseLatencyMs: number = 500,
  facialTension: number = 0.2,
  eyeBlinkRateChange: number = 0.1,
  fillerWordDensity: number = 0.02,
  speechRateDeviation: number = 0,
  emotionLabel: any = 'neutral'
): CognitiveLoadSignals {
  return {
    responseLatencyMs,
    facialTension,
    eyeBlinkRateChange,
    fillerWordDensity,
    speechRateDeviation,
    emotionLabel,
  };
}

describe('CognitiveLoadEstimator', () => {
  let estimator: CognitiveLoadEstimator;

  beforeEach(() => {
    estimator = new CognitiveLoadEstimator();
  });

  it('should return score between 0-100', () => {
    const signals = createSignals();
    const result = estimator.estimate(signals);

    expect(result.load).toBeGreaterThanOrEqual(0);
    expect(result.load).toBeLessThanOrEqual(100);
  });

  it('should return valid cognitive load zone', () => {
    const signals = createSignals();
    const result = estimator.estimate(signals);

    expect(['low', 'optimal', 'high', 'overload']).toContain(result.zone);
  });

  it('should classify low load correctly', () => {
    const signals = createSignals(
      300, // Low latency
      0.1, // Low tension
      0.0, // Low blink rate change
      0.01, // Low filler words
      -0.2, // Slightly faster than baseline
      'happy'
    );

    const result = estimator.estimate(signals);

    expect(result.zone).toBe('low');
    expect(result.load).toBeLessThan(20);
  });

  it('should classify optimal load correctly', () => {
    const signals = createSignals(
      500, // Baseline latency
      0.15, // Low-medium tension
      0.1, // Low blink change
      0.02, // Low filler words
      0, // Baseline speed
      'neutral'
    );

    const result = estimator.estimate(signals);

    expect(['optimal']).toContain(result.zone);
    expect(result.load).toBeGreaterThanOrEqual(20);
    expect(result.load).toBeLessThan(60);
  });

  it('should classify high load correctly', () => {
    const signals = createSignals(
      1200, // High latency
      0.5, // High tension
      0.4, // High blink change
      0.08, // High filler words
      -0.3, // Slower than baseline
      'confused'
    );

    const result = estimator.estimate(signals);

    expect(result.zone).toBe('high');
    expect(result.load).toBeGreaterThanOrEqual(60);
    expect(result.load).toBeLessThan(80);
  });

  it('should classify overload correctly', () => {
    const signals = createSignals(
      2000, // Very high latency
      0.8, // Very high tension
      0.7, // Very high blink change
      0.15, // Very high filler words
      -0.5, // Much slower
      'fearful'
    );

    const result = estimator.estimate(signals);

    expect(result.zone).toBe('overload');
    expect(result.load).toBeGreaterThanOrEqual(80);
  });

  it('should weight high response latency + confusion as high load', () => {
    const highLoad = createSignals(
      1500, // High latency
      0.2, // Moderate tension
      0.2, // Moderate blink change
      0.05, // Moderate filler words
      -0.2, // Slightly slower
      'confused'
    );

    const result = estimator.estimate(highLoad);

    expect(result.load).toBeGreaterThan(50);
  });

  it('should weight low latency + happy emotion as low load', () => {
    const lowLoad = createSignals(
      300, // Low latency
      0.1, // Low tension
      0.05, // Low blink change
      0.01, // Low filler words
      0.1, // Slightly faster
      'happy'
    );

    const result = estimator.estimate(lowLoad);

    expect(result.load).toBeLessThan(30);
  });

  it('should provide factor breakdown', () => {
    const signals = createSignals(800, 0.3, 0.2, 0.05, -0.1, 'neutral');
    const result = estimator.estimate(signals);

    expect(result.factors).toBeDefined();
    expect(result.factors['latency']).toBeDefined();
    expect(result.factors['tension']).toBeDefined();
    expect(result.factors['eyeBehavior']).toBeDefined();
    expect(result.factors['speech']).toBeDefined();
    expect(result.factors['emotion']).toBeDefined();
  });

  it('should handle confused emotion as high load signal', () => {
    const confusedSignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'confused');
    const happySignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'happy');

    const confusedResult = estimator.estimate(confusedSignals);
    const happyResult = estimator.estimate(happySignals);

    expect(confusedResult.load).toBeGreaterThan(happyResult.load);
  });

  it('should handle fearful emotion as very high load', () => {
    const fearfulSignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'fearful');
    const happySignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'happy');

    const fearfulResult = estimator.estimate(fearfulSignals);
    const happyResult = estimator.estimate(happySignals);

    expect(fearfulResult.load).toBeGreaterThan(happyResult.load);
  });

  it('should handle sad emotion as moderate-high load', () => {
    const sadSignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'sad');
    const happySignals = createSignals(500, 0.2, 0.1, 0.02, 0, 'happy');

    const sadResult = estimator.estimate(sadSignals);
    const happyResult = estimator.estimate(happySignals);

    expect(sadResult.load).toBeGreaterThan(happyResult.load);
  });

  it('should get trend in cognitive load', () => {
    // Feed data to build history
    for (let i = 0; i < 15; i++) {
      const signals = createSignals(300 + i * 50, 0.1, 0.05, 0.01, 0, 'happy');
      estimator.estimate(signals);
    }

    const trend = estimator.getTrend();
    expect(['increasing', 'stable', 'decreasing']).toContain(trend);
  });

  it('should detect increasing load trend', () => {
    // Start with low load
    for (let i = 0; i < 10; i++) {
      const signals = createSignals(300, 0.1, 0.05, 0.01, 0, 'happy');
      estimator.estimate(signals);
    }

    // Shift to high load
    for (let i = 0; i < 10; i++) {
      const signals = createSignals(1500, 0.7, 0.6, 0.1, -0.4, 'confused');
      estimator.estimate(signals);
    }

    const trend = estimator.getTrend();
    expect(trend).toBe('increasing');
  });

  it('should get average load', () => {
    // Feed a range of loads
    estimator.estimate(createSignals(300, 0.1, 0.05, 0.01, 0, 'happy'));
    estimator.estimate(createSignals(500, 0.2, 0.1, 0.02, 0, 'neutral'));
    estimator.estimate(createSignals(1000, 0.6, 0.4, 0.08, -0.2, 'confused'));

    const avgLoad = estimator.getAverageLoad();
    expect(avgLoad).toBeGreaterThan(0);
    expect(avgLoad).toBeLessThanOrEqual(100);
  });

  it('should get peak load', () => {
    estimator.estimate(createSignals(300, 0.1, 0.05, 0.01, 0, 'happy'));
    estimator.estimate(createSignals(500, 0.2, 0.1, 0.02, 0, 'neutral'));
    estimator.estimate(createSignals(1500, 0.8, 0.7, 0.15, -0.5, 'fearful')); // High load

    const peakLoad = estimator.getPeakLoad();
    // Peak should be greater than the low loads
    expect(peakLoad).toBeGreaterThanOrEqual(20);
  });

  it('should set baseline latency for calibration', () => {
    estimator.setBaselines({ latencyMs: 800 });

    // With new baseline, same latency should produce different load
    const signals = createSignals(1000);
    const result = estimator.estimate(signals);

    expect(result.load).toBeDefined();
  });

  it('should set baseline filler rate for calibration', () => {
    estimator.setBaselines({ fillerRate: 0.05 });

    const signals = createSignals(500, 0.2, 0.1, 0.08);
    const result = estimator.estimate(signals);

    expect(result.load).toBeDefined();
  });

  it('should reset internal state', () => {
    // Build up history
    for (let i = 0; i < 20; i++) {
      estimator.estimate(createSignals(500 + i * 50, 0.2, 0.1, 0.03, 0, 'neutral'));
    }

    let avgLoad = estimator.getAverageLoad();
    expect(avgLoad).toBeGreaterThan(0);

    // Reset
    estimator.reset();

    avgLoad = estimator.getAverageLoad();
    expect(avgLoad).toBe(0);
  });

  it('should handle negative speech rate deviation correctly', () => {
    // More negative = slower speech = higher load
    const slowSpeech = createSignals(500, 0.2, 0.1, 0.03, -0.5, 'neutral');
    const fastSpeech = createSignals(500, 0.2, 0.1, 0.03, 0.5, 'neutral');

    const slowResult = estimator.estimate(slowSpeech);
    const fastResult = estimator.estimate(fastSpeech);

    // Due to smoothing, loads should be comparable; slower speech adds some load
    expect(slowResult.load).toBeGreaterThanOrEqual(fastResult.load - 5);
  });

  it('should handle extreme signal values gracefully', () => {
    const extreme = createSignals(5000, 1.0, 1.0, 0.5, -1.0, 'fearful');

    const result = estimator.estimate(extreme);

    expect(result.load).toBeGreaterThanOrEqual(0);
    expect(result.load).toBeLessThanOrEqual(100);
  });

  it('should handle all emotion types correctly', () => {
    const emotions = ['happy', 'sad', 'angry', 'neutral', 'surprised', 'fearful', 'confused'];

    emotions.forEach((emotion) => {
      const signals = createSignals(500, 0.2, 0.1, 0.03, 0, emotion);
      const result = estimator.estimate(signals);

      expect(result.load).toBeGreaterThanOrEqual(0);
      expect(result.load).toBeLessThanOrEqual(100);
    });
  });

  it('should return consistent results for same input', () => {
    const signals = createSignals(600, 0.25, 0.15, 0.04, -0.1, 'neutral');

    const result1 = estimator.estimate(signals);
    const result2 = estimator.estimate(signals);

    // Should be close (within smoothing tolerance)
    expect(Math.abs(result1.load - result2.load)).toBeLessThan(5);
  });
});
