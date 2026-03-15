import { ComprehensionSignals, AhaMoment, ComprehensionSignalType } from './types';
import { RollingWindow } from '../utils/smoothing';

/**
 * Detects comprehension breakthroughs and prolonged confusion
 * Looks for "aha moments" where understanding is achieved
 */
export class ComprehensionDetector {
  private ahaMoments: AhaMoment[] = [];
  private confusionPeriods: Array<{ startMs: number; endMs: number | null; resolved: boolean }> = [];
  private currentConfusionStart: number | null = null;
  private recentEmotions = new RollingWindow<{ emotion: string; timestamp: number }>(30);

  private readonly VERBAL_MARKERS = ['oh', 'i see', 'got it', 'makes sense', 'ah', 'aha', 'understood', 'clear now', 'that makes sense'];
  private readonly CONFUSION_THRESHOLD_MS = 30000; // 30 seconds of confusion is prolonged

  /**
   * Detect aha moments from multiple signal types
   */
  detect(signals: ComprehensionSignals): { ahaMoment: boolean; confidence: number; type?: ComprehensionSignalType } {
    let confidence = 0;
    let type: ComprehensionSignalType | undefined;

    // 1. Emotion shift: confused -> happy/neutral in < 3 seconds
    if (signals.emotionShift) {
      const { from, to, timeDeltaMs } = signals.emotionShift;
      const isPositiveShift = ['happy', 'neutral'].includes(to);
      const isQuickResolve = timeDeltaMs < 3000;

      if (isPositiveShift && isQuickResolve) {
        confidence = Math.max(confidence, 0.8);
        type = 'facial';
      }
    }

    // 2. Head nod after confusion period
    if (signals.headNodDetected) {
      confidence = Math.max(confidence, 0.7);
      type = type || 'behavioral';
    }

    // 3. Verbal signal
    if (signals.verbalMarker) {
      const isValidMarker = this.VERBAL_MARKERS.some(marker =>
        signals.verbalMarker!.toLowerCase().includes(marker)
      );
      if (isValidMarker) {
        confidence = Math.max(confidence, 0.9);
        type = 'verbal';
      }
    }

    // 4. Eye contact increase after looking away
    if (signals.eyeContactIncrease) {
      confidence = Math.max(confidence, 0.6);
      type = type || 'behavioral';
    }

    const ahaMoment = confidence > 0.5;

    if (ahaMoment) {
      const moment: AhaMoment = {
        timestamp: Date.now(),
        type: type || 'verbal',
        confidence: Math.min(1, confidence),
        description: this.generateDescription(signals),
      };
      this.ahaMoments.push(moment);

      // Resolve any active confusion period
      if (this.currentConfusionStart !== null) {
        const existingPeriod = this.confusionPeriods.find(p => p.endMs === null);
        if (existingPeriod) {
          existingPeriod.endMs = moment.timestamp;
          existingPeriod.resolved = true;
        }
        this.currentConfusionStart = null;
      }
    }

    return { ahaMoment, confidence, type };
  }

  /**
   * Record emotion for tracking confusion periods
   */
  recordEmotion(emotion: string, timestamp: number = Date.now()) {
    this.recentEmotions.push({ emotion, timestamp });

    // Track confusion periods
    if (emotion === 'confused') {
      if (this.currentConfusionStart === null) {
        // Start new confusion period
        this.currentConfusionStart = timestamp;
        this.confusionPeriods.push({
          startMs: timestamp,
          endMs: null,
          resolved: false,
        });
      }
    } else {
      // Potentially end confusion period (if non-confused emotion)
      if (this.currentConfusionStart !== null) {
        const duration = timestamp - this.currentConfusionStart;
        const existingPeriod = this.confusionPeriods.find(p => p.endMs === null);

        if (existingPeriod) {
          existingPeriod.endMs = timestamp;
          existingPeriod.resolved = true;
        }
        this.currentConfusionStart = null;
      }
    }
  }

  /**
   * Get all detected aha moments
   */
  getMoments(): AhaMoment[] {
    return [...this.ahaMoments];
  }

  /**
   * Get all confusion periods
   */
  getConfusionPeriods(): Array<{ startMs: number; endMs: number; resolved: boolean }> {
    return this.confusionPeriods
      .filter(period => period.endMs !== null)
      .map(period => ({
        startMs: period.startMs,
        endMs: period.endMs as number,
        resolved: period.resolved,
      }));
  }

  /**
   * Check for sustained confusion (> 30 seconds without resolution)
   */
  hasSustainedConfusion(): boolean {
    const now = Date.now();
    for (const period of this.confusionPeriods) {
      if (!period.resolved) {
        const duration = (period.endMs || now) - period.startMs;
        if (duration > this.CONFUSION_THRESHOLD_MS) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get most recent aha moment
   */
  getLastAhaMoment(): AhaMoment | null {
    return this.ahaMoments.length > 0 ? this.ahaMoments[this.ahaMoments.length - 1] : null;
  }

  /**
   * Get aha moments in a time window
   */
  getAhaMomentsInWindow(windowMs: number): AhaMoment[] {
    const cutoff = Date.now() - windowMs;
    return this.ahaMoments.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get comprehension success rate
   * Ratio of successful resolution to total confusion periods
   */
  getComprehensionSuccessRate(): number {
    if (this.confusionPeriods.length === 0) return 100;

    const resolvedCount = this.confusionPeriods.filter(p => p.resolved).length;
    return Math.round((resolvedCount / this.confusionPeriods.length) * 100);
  }

  /**
   * Get average time to resolve confusion
   */
  getAverageResolutionTime(): number {
    const resolved = this.confusionPeriods.filter(p => p.resolved && p.endMs !== null);
    if (resolved.length === 0) return 0;

    const totalTime = resolved.reduce((sum, p) => sum + ((p.endMs || 0) - p.startMs), 0);
    return Math.round(totalTime / resolved.length);
  }

  /**
   * Reset all state
   */
  reset() {
    this.ahaMoments = [];
    this.confusionPeriods = [];
    this.currentConfusionStart = null;
    this.recentEmotions.clear();
  }

  /**
   * Internal: generate description of aha moment
   */
  private generateDescription(signals: ComprehensionSignals): string {
    const parts: string[] = [];

    if (signals.emotionShift) {
      parts.push(`Emotion shifted from ${signals.emotionShift.from} to ${signals.emotionShift.to}`);
    }

    if (signals.verbalMarker) {
      parts.push(`Student said "${signals.verbalMarker}"`);
    }

    if (signals.headNodDetected) {
      parts.push('Head nod detected');
    }

    if (signals.eyeContactIncrease) {
      parts.push('Eye contact increased');
    }

    return parts.join(', ') || 'Comprehension breakthrough detected';
  }
}
