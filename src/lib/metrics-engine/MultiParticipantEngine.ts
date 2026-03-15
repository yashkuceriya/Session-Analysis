/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/refs */
/**
 * MultiParticipantEngine: Per-participant metrics tracking for group sessions.
 *
 * Extends the metrics engine to track individual participants:
 * - Eye contact / gaze estimation per person
 * - Expression analysis per person
 * - Audio metrics per person (speech rate, energy)
 * - Group-level metrics (participation equity, active speaker history)
 */

import { GazeEstimator } from '@/lib/video-processor/GazeEstimator';
import { ExpressionAnalyzer } from '@/lib/video-processor/ExpressionAnalyzer';
import { FaceFrame } from '@/lib/video-processor/types';
import { StudentState } from './types';

export interface ParticipantMetrics {
  peerId: string;
  eyeContactScore: number; // 0-1
  speechRate: number; // 0-1, fraction of time speaking
  energyScore: number; // 0-1
  studentState: StudentState;
  engagementScore: number; // 0-100
  isSpeaking: boolean;
  expressionState: string; // 'neutral', 'happy', 'confused', 'surprised', etc.
  lastUpdateTime: number;
}

export interface GroupMetrics {
  participationEquity: number; // 0-1, how evenly distributed is speaking time
  groupEngagement: number; // 0-100
  activeSpeakerHistory: string[]; // List of peer IDs, most recent first
  silenceCount: number; // Number of extended silences
  interruptionCount: number; // Cross-participant interruptions
  avgParticipationTime: number; // Average speaking time per person
  dominantSpeaker?: string; // Most frequent speaker
}

interface ParticipantState {
  gazeEstimator: GazeEstimator;
  expressionAnalyzer: ExpressionAnalyzer;
  metrics: ParticipantMetrics;
  speechTimeMs: number;
  totalTimeMs: number;
  recentSpeakingWindow: boolean[]; // Last N frames' speaking state
  speechRateHistory: number[];
  energyHistory: number[];
}

export class MultiParticipantEngine {
  private participants: Map<string, ParticipantState> = new Map();
  private activeSpeakerHistory: string[] = [];
  private lastActiveSpeaker: string | null = null;
  private activeSpeakerThresholdMs = 2000; // 2s to be considered active speaker
  private windowSize = 120; // ~2 seconds at 60fps

  private groupMetrics: GroupMetrics = {
    participationEquity: 0,
    groupEngagement: 0,
    activeSpeakerHistory: [],
    silenceCount: 0,
    interruptionCount: 0,
    avgParticipationTime: 0,
  };

  constructor(windowSize: number = 120) {
    this.windowSize = windowSize;
  }

  /**
   * Add a new participant to tracking.
   */
  addParticipant(peerId: string) {
    if (this.participants.has(peerId)) {
      console.warn(`Participant ${peerId} already exists`);
      return;
    }

    const gazeEstimator = new GazeEstimator();
    const expressionAnalyzer = new ExpressionAnalyzer();

    const participantState: ParticipantState = {
      gazeEstimator,
      expressionAnalyzer,
      metrics: {
        peerId,
        eyeContactScore: 0,
        speechRate: 0,
        energyScore: 0,
        studentState: 'engaged',
        engagementScore: 50,
        isSpeaking: false,
        expressionState: 'neutral',
        lastUpdateTime: Date.now(),
      },
      speechTimeMs: 0,
      totalTimeMs: 0,
      recentSpeakingWindow: [],
      speechRateHistory: [],
      energyHistory: [],
    };

    this.participants.set(peerId, participantState);
  }

  /**
   * Remove a participant from tracking.
   */
  removeParticipant(peerId: string) {
    const state = this.participants.get(peerId);
    if (!state) return;

    // Cleanup (estimators don't require explicit disposal)

    this.participants.delete(peerId);

    // Remove from active speaker history
    this.activeSpeakerHistory = this.activeSpeakerHistory.filter((id) => id !== peerId);
  }

  /**
   * Process video frame for a participant.
   */
  async processFrame(peerId: string, faceFrame: FaceFrame) {
    const state = this.participants.get(peerId);
    if (!state) return;

    try {
      // Estimate gaze
      const gazeData = state.gazeEstimator.estimate(faceFrame.landmarks);
      state.metrics.eyeContactScore = gazeData?.confidence ?? 0;

      // Analyze expressions
      const expression = state.expressionAnalyzer.analyze(faceFrame.landmarks, faceFrame.blendshapes);
      state.metrics.expressionState = this.getExpressionLabel(expression);

      // Update engagement based on expression and eye contact
      state.metrics.engagementScore = this.calculateEngagement(
        state.metrics.eyeContactScore,
        state.metrics.speechRate,
        state.metrics.expressionState
      );

      // Determine student state
      state.metrics.studentState = this.inferStudentState(
        state.metrics.engagementScore,
        state.metrics.speechRate,
        state.metrics.expressionState
      );

      state.metrics.lastUpdateTime = Date.now();
    } catch (err) {
      console.error(`Frame processing error for ${peerId}:`, err);
    }
  }

  /**
   * Process audio data for a participant.
   */
  processAudio(peerId: string, audioData: Float32Array, sampleRate: number) {
    const state = this.participants.get(peerId);
    if (!state) return;

    // Calculate RMS energy
    const energy = this.calculateRMS(audioData);
    state.metrics.energyScore = Math.min(1, energy / 0.05); // Normalize to typical voice energy

    // Detect speech (simple threshold)
    const isSpeaking = energy > 0.005;
    state.metrics.isSpeaking = isSpeaking;

    // Track speaking time
    state.recentSpeakingWindow.push(isSpeaking);
    if (state.recentSpeakingWindow.length > this.windowSize) {
      state.recentSpeakingWindow.shift();
    }

    // Update speech rate
    const speakingFrames = state.recentSpeakingWindow.filter((v) => v).length;
    state.metrics.speechRate = speakingFrames / this.windowSize;

    // Track history
    state.speechRateHistory.push(state.metrics.speechRate);
    state.energyHistory.push(state.metrics.energyScore);

    // Keep history bounded
    if (state.speechRateHistory.length > 300) {
      state.speechRateHistory.shift();
      state.energyHistory.shift();
    }

    // Track time (frames are ~33ms at 30fps)
    state.totalTimeMs += 33;
    if (isSpeaking) {
      state.speechTimeMs += 33;
    }
  }

  /**
   * Get metrics for a specific participant.
   */
  getParticipantMetrics(peerId: string): ParticipantMetrics | null {
    const state = this.participants.get(peerId);
    return state?.metrics ?? null;
  }

  /**
   * Get all participant metrics.
   */
  getAllParticipantMetrics(): ParticipantMetrics[] {
    return Array.from(this.participants.values()).map((s) => s.metrics);
  }

  /**
   * Get group-level metrics.
   */
  getGroupMetrics(): GroupMetrics {
    this.updateGroupMetrics();
    return this.groupMetrics;
  }

  /**
   * Update active speaker.
   */
  updateActiveSpeaker(peerId: string) {
    if (peerId === this.lastActiveSpeaker) return;

    this.lastActiveSpeaker = peerId;

    // Add to history if not already recent
    if (this.activeSpeakerHistory[0] !== peerId) {
      this.activeSpeakerHistory.unshift(peerId);
      // Keep last 10 speakers
      if (this.activeSpeakerHistory.length > 10) {
        this.activeSpeakerHistory.pop();
      }
    }

    this.groupMetrics.activeSpeakerHistory = [...this.activeSpeakerHistory];
  }

  /**
   * Calculate engagement score for a participant.
   */
  private calculateEngagement(eyeContact: number, speechRate: number, expression: string): number {
    const eyeContactWeight = 0.3;
    const speechRateWeight = 0.4;
    const expressionWeight = 0.3;

    let expressionScore = 0.5; // Neutral
    if (expression === 'happy' || expression === 'surprised') {
      expressionScore = 0.8;
    } else if (expression === 'confused' || expression === 'neutral') {
      expressionScore = 0.5;
    } else if (expression === 'angry' || expression === 'disgust') {
      expressionScore = 0.2;
    }

    const engagement =
      eyeContact * eyeContactWeight + speechRate * speechRateWeight + expressionScore * expressionWeight;

    return Math.round(engagement * 100);
  }

  /**
   * Infer student state from metrics.
   */
  private inferStudentState(
    engagementScore: number,
    speechRate: number,
    expression: string
  ): StudentState {
    if (engagementScore < 30) {
      return 'drifting';
    }

    if (expression === 'confused') {
      return 'confused';
    }

    if (speechRate < 0.1 && engagementScore < 50) {
      return 'passive';
    }

    if (engagementScore > 70 && speechRate > 0.3) {
      return 'engaged';
    }

    if (engagementScore > 50 && expression === 'surprised') {
      return 'engaged';
    }

    if (speechRate > 0.5 && engagementScore > 40) {
      return 'struggling'; // Over-talking might indicate confusion
    }

    return 'engaged';
  }

  /**
   * Map expression result to label.
   */
  private getExpressionLabel(expression: any): string {
    if (!expression) return 'neutral';

    // Determine dominant expression
    if ((expression.surprise ?? 0) > 0.6) return 'surprised';
    if ((expression.confusion ?? 0) > 0.5) return 'confused';
    if ((expression.smile ?? 0) > 0.6) return 'happy';
    if ((expression.browFurrow ?? 0) > 0.5) return 'angry';
    if ((expression.energy ?? 0) > 0.7) return 'energetic';

    return 'neutral';
  }

  /**
   * Calculate RMS energy of audio.
   */
  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Update group-level metrics.
   */
  private updateGroupMetrics() {
    const participants = Array.from(this.participants.values());

    if (participants.length === 0) {
      this.groupMetrics = {
        participationEquity: 0,
        groupEngagement: 0,
        activeSpeakerHistory: [],
        silenceCount: 0,
        interruptionCount: 0,
        avgParticipationTime: 0,
      };
      return;
    }

    // Calculate average engagement
    const avgEngagement =
      participants.reduce((sum, p) => sum + p.metrics.engagementScore, 0) / participants.length;

    // Calculate participation equity (Gini coefficient approximation)
    const speechTimes = participants.map((p) => p.speechTimeMs);
    const avgSpeechTime = speechTimes.reduce((a, b) => a + b, 0) / participants.length;
    const deviations = speechTimes.map((t) => Math.abs(t - avgSpeechTime));
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / participants.length;
    const equity = 1 - (avgDeviation / (avgSpeechTime + 0.1)); // Avoid division by zero

    // Find dominant speaker
    let dominantSpeaker: string | undefined;
    let maxSpeechTime = 0;
    participants.forEach((p) => {
      if (p.speechTimeMs > maxSpeechTime) {
        maxSpeechTime = p.speechTimeMs;
        dominantSpeaker = p.metrics.peerId;
      }
    });

    this.groupMetrics = {
      participationEquity: Math.max(0, Math.min(1, equity)),
      groupEngagement: Math.round(avgEngagement),
      activeSpeakerHistory: this.activeSpeakerHistory,
      silenceCount: 0, // Would require additional tracking
      interruptionCount: 0, // Would require additional tracking
      avgParticipationTime: avgSpeechTime,
      dominantSpeaker,
    };
  }

  /**
   * Reset all metrics.
   */
  reset() {
    this.participants.clear();
    this.activeSpeakerHistory = [];
    this.lastActiveSpeaker = null;
    this.groupMetrics = {
      participationEquity: 0,
      groupEngagement: 0,
      activeSpeakerHistory: [],
      silenceCount: 0,
      interruptionCount: 0,
      avgParticipationTime: 0,
    };
  }
}
