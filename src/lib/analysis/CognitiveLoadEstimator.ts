import { CognitiveLoadSignals, CognitiveLoadResult } from './types';
import { EMA, RollingWindow } from '../utils/smoothing';

/**
 * Estimates cognitive load (0-100) from multiple signals
 * Combines response latency, facial tension, eye behavior, speech patterns, and emotion
 */
export class CognitiveLoadEstimator {
  private loadHistory = new RollingWindow<number>(100);
  private loadEMA = new EMA(0.2); // Temporal smoothing for load trend

  // Baseline tracking
  private baselineLatencyMs = 500; // Default response latency
  private baselineFillerRate = 0.02; // Default filler rate
  private baselineSpeechRateWPM = 140; // Default WPM

  /**
   * Estimate cognitive load from composite signals
   * Returns load score (0-100) and classification zone
   */
  estimate(signals: CognitiveLoadSignals): CognitiveLoadResult {
    const factors: Record<string, number> = {};

    // 1. Response latency (weight 0.3)
    // Longer latency = higher cognitive load (thinking hard)
    const latencyRatio = signals.responseLatencyMs / this.baselineLatencyMs;
    const latencyFactor = Math.min(1, Math.max(0, (latencyRatio - 0.5) / 2)); // 0.5x baseline = 0, 2.5x = 1
    factors['latency'] = latencyFactor * 100;

    // 2. Facial tension (weight 0.2)
    // browFurrow + jawClench, already 0-1
    const tensionFactor = signals.facialTension;
    factors['tension'] = tensionFactor * 100;

    // 3. Eye behavior (weight 0.2)
    // Increased blink rate or gaze scatter = cognitive load
    const eyeBehaviorFactor = signals.eyeBlinkRateChange;
    factors['eyeBehavior'] = eyeBehaviorFactor * 100;

    // 4. Speech patterns (weight 0.15)
    // Higher filler words + slower speech = higher load
    const fillerDeviation = signals.fillerWordDensity / this.baselineFillerRate;
    const speechRateDeviation = Math.abs(signals.speechRateDeviation); // Negative deviation (slower) = load
    const speechFactor = Math.min(1, (fillerDeviation * 0.5 + Math.max(0, speechRateDeviation) * 0.5));
    factors['speech'] = speechFactor * 100;

    // 5. Emotion (weight 0.15)
    // Confused, fearful, sad = higher load
    let emotionFactor = 0;
    switch (signals.emotionLabel) {
      case 'confused':
        emotionFactor = 0.9;
        break;
      case 'fearful':
        emotionFactor = 0.8;
        break;
      case 'sad':
        emotionFactor = 0.6;
        break;
      case 'angry':
        emotionFactor = 0.5;
        break;
      case 'surprised':
        emotionFactor = 0.4;
        break;
      case 'happy':
      case 'neutral':
      default:
        emotionFactor = 0.1;
    }
    factors['emotion'] = emotionFactor * 100;

    // Weighted sum
    const weights = {
      latency: 0.3,
      tension: 0.2,
      eyeBehavior: 0.2,
      speech: 0.15,
      emotion: 0.15,
    };

    const loadRaw =
      latencyFactor * weights.latency +
      tensionFactor * weights.tension +
      eyeBehaviorFactor * weights.eyeBehavior +
      speechFactor * weights.speech +
      emotionFactor * weights.emotion;

    // Convert to 0-100 scale and apply smoothing
    const load = Math.round(this.loadEMA.update(loadRaw) * 100);
    this.loadHistory.push(load);

    // Classify into zones
    let zone: 'low' | 'optimal' | 'high' | 'overload';
    if (load < 20) {
      zone = 'low';
    } else if (load < 30) {
      zone = 'optimal'; // Lower bound of optimal (flow state possible)
    } else if (load < 60) {
      zone = 'optimal';
    } else if (load < 80) {
      zone = 'high';
    } else {
      zone = 'overload';
    }

    return {
      load,
      zone,
      factors,
    };
  }

  /**
   * Get trend in cognitive load
   */
  getTrend(): 'increasing' | 'stable' | 'decreasing' {
    const history = this.loadHistory.getAll();
    if (history.length < 10) return 'stable';

    const recent = history.slice(-10);
    const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = recent.slice(5).reduce((a, b) => a + b, 0) / 5;

    const diff = secondHalf - firstHalf;
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Get average load over recent history
   */
  getAverageLoad(): number {
    if (this.loadHistory.length === 0) return 0;
    const loads = this.loadHistory.getAll();
    return Math.round(loads.reduce((a, b) => a + b, 0) / loads.length);
  }

  /**
   * Get peak load (worst moment)
   */
  getPeakLoad(): number {
    if (this.loadHistory.length === 0) return 0;
    return Math.max(...this.loadHistory.getAll());
  }

  /**
   * Set baselines from observed data (calibration)
   */
  setBaselines(options: {
    latencyMs?: number;
    fillerRate?: number;
    speechRateWPM?: number;
  }) {
    if (options.latencyMs !== undefined) {
      this.baselineLatencyMs = options.latencyMs;
    }
    if (options.fillerRate !== undefined) {
      this.baselineFillerRate = options.fillerRate;
    }
    if (options.speechRateWPM !== undefined) {
      this.baselineSpeechRateWPM = options.speechRateWPM;
    }
  }

  /**
   * Reset all state
   */
  reset() {
    this.loadHistory.clear();
    this.loadEMA.reset();
  }
}
