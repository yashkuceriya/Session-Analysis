/**
 * Shared types for the deeper session analysis engine
 */

// Emotion classification
export type EmotionLabel = 'happy' | 'sad' | 'angry' | 'neutral' | 'surprised' | 'fearful' | 'confused';

export interface EmotionResult {
  emotion: EmotionLabel;
  confidence: number;
  allScores: Record<EmotionLabel, number>;
}

// Bloom's Taxonomy classification
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface BloomResult {
  level: BloomLevel;
  confidence: number;
  keywords: string[];
}

// Cognitive load estimation
export interface CognitiveLoadSignals {
  responseLatencyMs: number;
  facialTension: number; // browFurrow + jawClench, 0-1
  eyeBlinkRateChange: number; // 0-1, deviation from baseline
  fillerWordDensity: number; // 0-1
  speechRateDeviation: number; // actual vs baseline
  emotionLabel: EmotionLabel;
}

export interface CognitiveLoadResult {
  load: number; // 0-100
  zone: 'low' | 'optimal' | 'high' | 'overload';
  factors: Record<string, number>;
}

// Flow state detection
export interface FlowState {
  inFlow: boolean;
  flowScore: number; // 0-100
  duration: number; // ms
  factors: Record<string, boolean>;
}

export interface FlowEpisode {
  startMs: number;
  endMs: number;
  avgScore: number;
}

// Speech analytics
export interface SpeechAnalyticsResult {
  speechRateWPM: number;
  fillerWordCount: number;
  fillerWords: string[];
  fillerDensity: number; // 0-1
  questionCount: number;
  questionDensity: number; // questions per minute
  avgResponseLatencyMs: number;
  confidenceScore: number; // 0-1
}

// Participation equity
export interface ParticipationReport {
  dominantSpeaker: string;
  leastActiveSpeaker: string;
  talkTimeDistribution: Record<string, number>;
  equityScore: number; // 0-100
  giniCoefficient: number; // 0-1
  recommendations: string[];
  participantDetails: ParticipantEquityMetrics[];
}

export interface ParticipantEquityMetrics {
  id: string;
  talkTimeMs: number;
  turnCount: number;
  questionCount: number;
  talkTimePercent: number;
  avgTurnDurationMs: number;
}

// Comprehension detection
export type ComprehensionSignalType = 'verbal' | 'facial' | 'behavioral';

export interface ComprehensionSignals {
  emotionShift: { from: EmotionLabel; to: EmotionLabel; timeDeltaMs: number } | null;
  headNodDetected: boolean;
  verbalMarker: string | null; // e.g., "I see", "got it"
  eyeContactIncrease: boolean;
}

export interface AhaMoment {
  timestamp: number;
  type: ComprehensionSignalType;
  confidence: number;
  description: string;
}

// Attention heatmap
export interface Hotspot {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  intensity: number; // 0-1
  durationMs: number;
}

export interface HeatmapSnapshot {
  grid: number[][]; // 2D array of 0-1 values
  hotspots: Hotspot[];
  offScreenTimePercent: number;
  totalGazePointsCount: number;
}

// Session-wide analytics
export interface SessionAnalysis {
  emotionTimeline: Array<{ timestamp: number; emotion: EmotionLabel; confidence: number }>;
  bloomProfile: Record<BloomLevel, number>; // count of each level
  bloomProgression: 'deepening' | 'stable' | 'regressing'; // are questions getting deeper?
  avgCognitiveLoad: number; // 0-100
  cognitiveLoadTrend: 'increasing' | 'stable' | 'decreasing';
  flowEpisodes: FlowEpisode[];
  totalFlowTimeMs: number;
  comprehensionMoments: AhaMoment[];
  confusionPeriods: Array<{ startMs: number; endMs: number; resolved: boolean }>;
  speechAnalytics: SpeechAnalyticsResult;
  participationEquity: ParticipationReport;
  attentionHeatmap: HeatmapSnapshot;
}
