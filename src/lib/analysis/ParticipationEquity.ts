import { ParticipationReport, ParticipantEquityMetrics } from './types';
import { RollingWindow } from '../utils/smoothing';

/**
 * Computes participation fairness metrics across multiple participants
 * Includes Gini coefficient, equity score, and trend analysis
 */
export class ParticipationEquity {
  private equityHistory = new RollingWindow<number>(50);
  private giniHistory = new RollingWindow<number>(50);

  /**
   * Compute Gini coefficient (0 = perfectly equal, 1 = one person dominates)
   * Formula: G = (2 * sum(i * x_i)) / (n * sum(x_i)) - (n+1)/n
   */
  computeGini(talkTimes: Record<string, number>): number {
    const values = Object.values(talkTimes);
    if (values.length === 0) return 0;

    // Sort in ascending order
    values.sort((a, b) => a - b);

    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);

    if (sum === 0) return 0; // No talk time at all

    let giniSum = 0;
    for (let i = 0; i < n; i++) {
      giniSum += (i + 1) * values[i];
    }

    const gini = (2 * giniSum) / (n * sum) - (n + 1) / n;
    return Math.max(0, Math.min(1, gini)); // Clamp to 0-1
  }

  /**
   * Compute equity score (0-100, where 100 = perfectly balanced)
   */
  computeEquityScore(talkTimes: Record<string, number>): number {
    const gini = this.computeGini(talkTimes);
    // Convert Gini to equity: perfect equality (Gini=0) -> equity=100, perfect inequality -> equity=0
    const equity = (1 - gini) * 100;
    this.equityHistory.push(equity);
    this.giniHistory.push(gini);
    return Math.round(equity);
  }

  /**
   * Generate comprehensive participation report
   */
  getParticipationReport(participants: Array<{
    id: string;
    talkTimeMs: number;
    turnCount: number;
    questionCount: number;
  }>): ParticipationReport {
    if (participants.length === 0) {
      return {
        dominantSpeaker: '',
        leastActiveSpeaker: '',
        talkTimeDistribution: {},
        equityScore: 0,
        giniCoefficient: 0,
        recommendations: [],
        participantDetails: [],
      };
    }

    const totalTalkTime = participants.reduce((sum, p) => sum + p.talkTimeMs, 0);

    // Build talk time distribution
    const talkTimes: Record<string, number> = {};
    const details: ParticipantEquityMetrics[] = [];

    for (const participant of participants) {
      const talkTimePercent = totalTalkTime > 0 ? participant.talkTimeMs / totalTalkTime : 0;
      talkTimes[participant.id] = participant.talkTimeMs;

      const avgTurnDuration = participant.turnCount > 0
        ? participant.talkTimeMs / participant.turnCount
        : 0;

      details.push({
        id: participant.id,
        talkTimeMs: participant.talkTimeMs,
        turnCount: participant.turnCount,
        questionCount: participant.questionCount,
        talkTimePercent: Math.round(talkTimePercent * 100),
        avgTurnDurationMs: Math.round(avgTurnDuration),
      });
    }

    // Find dominant and least active speakers
    const sorted = [...details].sort((a, b) => b.talkTimeMs - a.talkTimeMs);
    const dominantSpeaker = sorted[0]?.id || '';
    const leastActiveSpeaker = sorted[sorted.length - 1]?.id || '';

    // Compute equity metrics
    const gini = this.computeGini(talkTimes);
    const equityScore = this.computeEquityScore(talkTimes);

    // Generate recommendations
    const recommendations = this.generateRecommendations(sorted, equityScore, participants.length);

    return {
      dominantSpeaker,
      leastActiveSpeaker,
      talkTimeDistribution: Object.fromEntries(
        Object.entries(talkTimes).map(([id, ms]) => [id, Math.round(ms / 1000)])
      ),
      equityScore,
      giniCoefficient: Math.round(gini * 100) / 100,
      recommendations,
      participantDetails: details,
    };
  }

  /**
   * Get equity trend
   */
  getEquityTrend(): 'improving' | 'stable' | 'declining' {
    if (this.equityHistory.length < 10) return 'stable';

    const recent = this.equityHistory.getAll().slice(-10);
    const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = recent.slice(5).reduce((a, b) => a + b, 0) / 5;

    const diff = secondHalf - firstHalf;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  }

  /**
   * Get average equity score
   */
  getAverageEquity(): number {
    if (this.equityHistory.length === 0) return 0;
    const values = this.equityHistory.getAll();
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  /**
   * Reset all state
   */
  reset() {
    this.equityHistory.clear();
    this.giniHistory.clear();
  }

  /**
   * Internal: generate recommendations based on participation patterns
   */
  private generateRecommendations(
    sorted: ParticipantEquityMetrics[],
    equityScore: number,
    totalParticipants: number
  ): string[] {
    const recommendations: string[] = [];

    if (equityScore < 30) {
      recommendations.push('Participation is heavily imbalanced - encourage quieter participants to share more');
    } else if (equityScore < 60) {
      recommendations.push('Some participants are dominating - consider using turn-taking strategies');
    }

    if (sorted.length >= 2) {
      const topTalkTime = sorted[0].talkTimeMs;
      const secondTalkTime = sorted[1].talkTimeMs;
      const ratio = topTalkTime / Math.max(1, secondTalkTime);

      if (ratio > 3) {
        recommendations.push(
          `${sorted[0].id} is speaking significantly more than others - invite other perspectives`
        );
      }
    }

    if (sorted.length > 0) {
      const leastActive = sorted[sorted.length - 1];
      if (leastActive.talkTimeMs === 0) {
        recommendations.push(`${leastActive.id} hasn't participated yet - encourage their input`);
      } else if (leastActive.talkTimePercent < 10 && totalParticipants > 1) {
        recommendations.push(
          `${leastActive.id} is contributing less than 10% - create space for their voice`
        );
      }
    }

    // Question asking fairness
    const questioners = sorted.filter(p => p.questionCount > 0);
    if (questioners.length > 0) {
      const topQuestioner = questioners[0];
      const avgQuestions = questioners.reduce((sum, p) => sum + p.questionCount, 0) / questioners.length;
      if (topQuestioner.questionCount > avgQuestions * 2) {
        recommendations.push('Consider balancing who asks questions to encourage more dialogue');
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Good participation balance - maintain current engagement level');
    }

    return recommendations;
  }
}
