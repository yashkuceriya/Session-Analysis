import { FlowState, FlowEpisode, CognitiveLoadResult } from './types';
import { EMA, RollingWindow } from '../utils/smoothing';

/**
 * Detects flow state based on Csikszentmihalyi's model
 * Balance of challenge (cognitive load) + skill (engagement) + focus
 */
export class FlowStateDetector {
  private flowHistory = new RollingWindow<boolean>(120); // ~60s at 2Hz
  private flowEpisodes: FlowEpisode[] = [];
  private currentEpisodeStart: number | null = null;
  private flowScoreEMA = new EMA(0.3);

  private readonly MIN_FLOW_DURATION_MS = 2000; // At least 2 seconds

  /**
   * Detect if currently in flow state
   * Flow requires:
   * - Engagement score > 70
   * - Cognitive load in optimal zone (30-60)
   * - Good eye contact (> 60%)
   * - Active participation (talk time > 20%)
   * - Low filler word density
   * - No confused/fearful emotions
   * - Sustained conditions
   */
  detect(signals: {
    engagementScore: number; // 0-100
    cognitiveLoad: CognitiveLoadResult;
    eyeContactScore: number; // 0-1
    talkTimePercent: number; // 0-1
    fillerWordDensity: number; // 0-1
    emotionLabel: string;
    isSpeaking: boolean;
    timestamp: number;
  }): FlowState {
    // Check individual flow conditions
    const engagementGood = signals.engagementScore > 70;
    const loadOptimal = signals.cognitiveLoad.zone === 'optimal';
    const eyeContactGood = signals.eyeContactScore > 0.6;
    const participationActive = signals.talkTimePercent > 0.2;
    const fillerLow = signals.fillerWordDensity < 0.05;
    const emotionPositive = !['confused', 'fearful', 'sad', 'angry'].includes(signals.emotionLabel);

    // Flow likelihood score (0-1)
    const flowLikelihood =
      (engagementGood ? 1 : 0) * 0.25 +
      (loadOptimal ? 1 : 0) * 0.25 +
      (eyeContactGood ? 1 : 0) * 0.15 +
      (participationActive ? 1 : 0) * 0.15 +
      (fillerLow ? 1 : 0) * 0.1 +
      (emotionPositive ? 1 : 0) * 0.1;

    // Require at least 70% of conditions for flow
    const inFlow = flowLikelihood > 0.7;

    // Update history
    this.flowHistory.push(inFlow);

    // Track episodes
    if (inFlow && !this.currentEpisodeStart) {
      this.currentEpisodeStart = signals.timestamp;
    } else if (!inFlow && this.currentEpisodeStart !== null) {
      const duration = signals.timestamp - this.currentEpisodeStart;
      if (duration >= this.MIN_FLOW_DURATION_MS) {
        // Calculate average flow score for this episode
        const episodeHistory = this.flowHistory.getAll();
        const flowCount = episodeHistory.filter(f => f).length;
        const avgFlowScore = Math.round((flowCount / episodeHistory.length) * 100);

        this.flowEpisodes.push({
          startMs: this.currentEpisodeStart,
          endMs: signals.timestamp,
          avgScore: avgFlowScore,
        });
      }
      this.currentEpisodeStart = null;
    }

    // Calculate flow score (0-100)
    const recentHistory = this.flowHistory.getAll().slice(-20);
    const recentFlowRatio = recentHistory.length > 0
      ? recentHistory.filter(f => f).length / recentHistory.length
      : 0;
    const flowScore = Math.round(this.flowScoreEMA.update(recentFlowRatio) * 100);

    // Current episode duration (or 0 if not in flow)
    const duration = inFlow && this.currentEpisodeStart
      ? signals.timestamp - this.currentEpisodeStart
      : 0;

    return {
      inFlow,
      flowScore,
      duration,
      factors: {
        engagementGood,
        loadOptimal,
        eyeContactGood,
        participationActive,
        fillerLow,
        emotionPositive,
      },
    };
  }

  /**
   * Get all completed flow episodes
   */
  getFlowEpisodes(): FlowEpisode[] {
    return [...this.flowEpisodes];
  }

  /**
   * Get total time in flow (milliseconds)
   */
  getTotalFlowTime(): number {
    return this.flowEpisodes.reduce((sum, ep) => sum + (ep.endMs - ep.startMs), 0);
  }

  /**
   * Get longest flow episode
   */
  getLongestFlowEpisode(): FlowEpisode | null {
    if (this.flowEpisodes.length === 0) return null;
    return this.flowEpisodes.reduce((max, ep) =>
      (ep.endMs - ep.startMs) > (max.endMs - max.startMs) ? ep : max
    );
  }

  /**
   * Get average flow score across all episodes
   */
  getAverageFlowScore(): number {
    if (this.flowEpisodes.length === 0) return 0;
    const totalScore = this.flowEpisodes.reduce((sum, ep) => sum + ep.avgScore, 0);
    return Math.round(totalScore / this.flowEpisodes.length);
  }

  /**
   * Get flow duration percentage
   */
  getFlowPercentage(totalSessionMs: number): number {
    if (totalSessionMs === 0) return 0;
    return Math.round((this.getTotalFlowTime() / totalSessionMs) * 100);
  }

  /**
   * Reset all state
   */
  reset() {
    this.flowHistory.clear();
    this.flowEpisodes = [];
    this.currentEpisodeStart = null;
    this.flowScoreEMA.reset();
  }
}
