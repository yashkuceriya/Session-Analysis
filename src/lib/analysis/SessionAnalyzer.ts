/**
 * Comprehensive session analyzer that integrates all analysis modules
 * Provides unified API for real-time tutoring session insights
 */

import { EmotionClassifier } from '../video-processor/EmotionClassifier';
import { AttentionHeatmap } from '../video-processor/AttentionHeatmap';
import { SpeechAnalytics } from '../audio-processor/SpeechAnalytics';
import { BloomClassifier } from './BloomClassifier';
import { CognitiveLoadEstimator } from './CognitiveLoadEstimator';
import { FlowStateDetector } from './FlowStateDetector';
import { ParticipationEquity } from './ParticipationEquity';
import { ComprehensionDetector } from './ComprehensionDetector';

import {
  SessionAnalysis,
  EmotionLabel,
  BloomLevel,
  AhaMoment,
  HeatmapSnapshot,
  SpeechAnalyticsResult,
  ParticipationReport,
} from './types';

/**
 * Main session analyzer interface
 * Coordinates all sub-analyzers for comprehensive session understanding
 */
export class SessionAnalyzer {
  private emotionClassifier = new EmotionClassifier();
  private attentionHeatmap = new AttentionHeatmap(10);
  private speechAnalytics = new SpeechAnalytics();
  private bloomClassifier = new BloomClassifier();
  private cognitiveLoadEstimator = new CognitiveLoadEstimator();
  private flowStateDetector = new FlowStateDetector();
  private participationEquity = new ParticipationEquity();
  private comprehensionDetector = new ComprehensionDetector();

  private sessionStartTime = Date.now();
  private emotionTimeline: Array<{ timestamp: number; emotion: EmotionLabel; confidence: number }> = [];
  private confusionPeriods: Array<{ startMs: number; endMs: number; resolved: boolean }> = [];

  /**
   * Update analyzer with latest frame data
   */
  updateFrame(signals: {
    blendshapes?: Record<string, number>;
    gazePoint?: { x: number; y: number };
    emotion?: EmotionLabel;
    timestamp?: number;
  }) {
    const timestamp = signals.timestamp || Date.now();

    // Update emotion classification
    if (signals.blendshapes) {
      const emotionResult = this.emotionClassifier.classify(signals.blendshapes);
      this.emotionClassifier.recordClassification(emotionResult.emotion, timestamp);

      this.emotionTimeline.push({
        timestamp,
        emotion: emotionResult.emotion,
        confidence: emotionResult.confidence,
      });

      // Record for comprehension detection
      this.comprehensionDetector.recordEmotion(emotionResult.emotion, timestamp);
    }

    // Update attention heatmap
    if (signals.gazePoint) {
      this.attentionHeatmap.addGazePoint(signals.gazePoint.x, signals.gazePoint.y, timestamp);
    }
  }

  /**
   * Analyze a student question/statement
   */
  analyzeQuestion(text: string, durationMs: number = 0) {
    // Classify by Bloom's Taxonomy
    const bloomResult = this.bloomClassifier.classifyQuestion(text);

    // Detect question type and record for statistics
    this.speechAnalytics.recordQuestion(text, durationMs);

    return bloomResult;
  }

  /**
   * Update cognitive load estimation
   */
  updateCognitiveLoad(signals: {
    responseLatencyMs: number;
    facialTension: number;
    eyeBlinkRateChange: number;
    fillerWordDensity: number;
    speechRateDeviation: number;
    emotionLabel: EmotionLabel;
  }) {
    return this.cognitiveLoadEstimator.estimate(signals);
  }

  /**
   * Update flow state detection
   */
  updateFlowState(signals: {
    engagementScore: number;
    eyeContactScore: number;
    talkTimePercent: number;
    fillerWordDensity: number;
    emotionLabel: EmotionLabel;
    isSpeaking: boolean;
    timestamp?: number;
  }) {
    const cognitiveLoad = this.cognitiveLoadEstimator.estimate({
      responseLatencyMs: 0,
      facialTension: 0,
      eyeBlinkRateChange: 0,
      fillerWordDensity: signals.fillerWordDensity,
      speechRateDeviation: 0,
      emotionLabel: signals.emotionLabel,
    });

    return this.flowStateDetector.detect({
      engagementScore: signals.engagementScore,
      cognitiveLoad,
      eyeContactScore: signals.eyeContactScore,
      talkTimePercent: signals.talkTimePercent,
      fillerWordDensity: signals.fillerWordDensity,
      emotionLabel: signals.emotionLabel,
      isSpeaking: signals.isSpeaking,
      timestamp: signals.timestamp || Date.now(),
    });
  }

  /**
   * Detect comprehension breakthrough
   */
  detectComprehension(signals: {
    emotionShift?: { from: EmotionLabel; to: EmotionLabel; timeDeltaMs: number };
    headNodDetected?: boolean;
    verbalMarker?: string;
    eyeContactIncrease?: boolean;
  }) {
    return this.comprehensionDetector.detect({
      emotionShift: signals.emotionShift || null,
      headNodDetected: signals.headNodDetected || false,
      verbalMarker: signals.verbalMarker || null,
      eyeContactIncrease: signals.eyeContactIncrease || false,
    });
  }

  /**
   * Update participation metrics
   */
  updateParticipation(participants: Array<{
    id: string;
    talkTimeMs: number;
    turnCount: number;
    questionCount: number;
  }>) {
    return this.participationEquity.getParticipationReport(participants);
  }

  /**
   * Analyze speech patterns from transcript/audio
   */
  analyzeSpeech(transcript: string, audioBuffer?: Float32Array, sampleRate: number = 16000) {
    const fillerWords = this.speechAnalytics.detectFillerWords(transcript);
    const wpm = audioBuffer ? this.speechAnalytics.analyzeSpeechRate(audioBuffer, sampleRate) : 0;

    return {
      wpm,
      fillerWords,
      avgSpeechRate: this.speechAnalytics.getAverageSpeechRate(),
      avgFillerRate: this.speechAnalytics.getAverageFillerRate(),
    };
  }

  /**
   * Get comprehensive session analysis snapshot
   */
  getSessionAnalysis(): SessionAnalysis {
    const elapsedMs = Date.now() - this.sessionStartTime;

    // Limit emotion timeline to last hour
    const emotionTimeline = this.emotionTimeline.filter(
      e => Date.now() - e.timestamp < 3600000
    );

    return {
      emotionTimeline,
      bloomProfile: this.bloomClassifier.getSessionBloomProfile(),
      bloomProgression: this.bloomClassifier.getProgression(),
      avgCognitiveLoad: this.cognitiveLoadEstimator.getAverageLoad(),
      cognitiveLoadTrend: this.cognitiveLoadEstimator.getTrend(),
      flowEpisodes: this.flowStateDetector.getFlowEpisodes(),
      totalFlowTimeMs: this.flowStateDetector.getTotalFlowTime(),
      comprehensionMoments: this.comprehensionDetector.getMoments(),
      confusionPeriods: this.comprehensionDetector.getConfusionPeriods(),
      speechAnalytics: {
        speechRateWPM: this.speechAnalytics.getAverageSpeechRate(),
        fillerWordCount: 0, // Would track cumulative
        fillerWords: [],
        fillerDensity: this.speechAnalytics.getAverageFillerRate(),
        questionCount: 0,
        questionDensity: this.speechAnalytics.getAverageQuestionRate(),
        avgResponseLatencyMs: this.speechAnalytics.getAverageResponseLatency(),
        confidenceScore: 0,
      },
      participationEquity: {
        dominantSpeaker: '',
        leastActiveSpeaker: '',
        talkTimeDistribution: {},
        equityScore: this.participationEquity.getAverageEquity(),
        giniCoefficient: 0,
        recommendations: [],
        participantDetails: [],
      },
      attentionHeatmap: this.attentionHeatmap.getSnapshot(),
    };
  }

  /**
   * Get high-level insights and recommendations
   */
  getInsights(): string[] {
    const insights: string[] = [];

    // Cognitive load insights
    const cogLoad = this.cognitiveLoadEstimator.getAverageLoad();
    if (cogLoad > 80) {
      insights.push('Student appears to be in cognitive overload - consider slowing down or breaking into smaller steps');
    } else if (cogLoad < 20) {
      insights.push('Student may not be sufficiently challenged - consider increasing difficulty');
    }

    // Flow state insights
    const flowTime = this.flowStateDetector.getTotalFlowTime();
    const elapsedMs = Date.now() - this.sessionStartTime;
    const flowPercent = (flowTime / elapsedMs) * 100;
    if (flowPercent > 30) {
      insights.push(`Student has been in flow state for ${Math.round(flowPercent)}% of the session - great engagement`);
    } else if (flowPercent < 10) {
      insights.push('Low time in flow state - check if pacing or difficulty needs adjustment');
    }

    // Comprehension insights
    const ahaMoments = this.comprehensionDetector.getMoments();
    if (ahaMoments.length > 0) {
      insights.push(`${ahaMoments.length} comprehension breakthrough(s) detected - student is learning`);
    }

    // Confusion insights
    if (this.comprehensionDetector.hasSustainedConfusion()) {
      insights.push('Student has been confused for an extended period - offer additional explanation or break');
    }

    // Bloom progression insights
    const progression = this.bloomClassifier.getProgression();
    if (progression === 'deepening') {
      insights.push('Questions are getting progressively deeper - good intellectual progression');
    } else if (progression === 'regressing') {
      insights.push('Questions seem to be becoming simpler - student may need more challenge');
    }

    return insights.length > 0 ? insights : ['Session proceeding normally'];
  }

  /**
   * Reset all analyzers
   */
  reset() {
    this.emotionClassifier.reset();
    this.attentionHeatmap.reset();
    this.speechAnalytics.reset();
    this.bloomClassifier.reset();
    this.cognitiveLoadEstimator.reset();
    this.flowStateDetector.reset();
    this.participationEquity.reset();
    this.comprehensionDetector.reset();

    this.sessionStartTime = Date.now();
    this.emotionTimeline = [];
    this.confusionPeriods = [];
  }

  /**
   * Get individual sub-analyzers (for advanced use cases)
   */
  getAnalyzers() {
    return {
      emotion: this.emotionClassifier,
      attention: this.attentionHeatmap,
      speech: this.speechAnalytics,
      bloom: this.bloomClassifier,
      cognitiveLoad: this.cognitiveLoadEstimator,
      flow: this.flowStateDetector,
      participation: this.participationEquity,
      comprehension: this.comprehensionDetector,
    };
  }
}
