import { GazeEstimator } from '../video-processor/GazeEstimator';
import { ExpressionAnalyzer } from '../video-processor/ExpressionAnalyzer';
import { SpeakingTimeTracker } from '../audio-processor/SpeakingTimeTracker';
import { InterruptionDetector } from '../audio-processor/InterruptionDetector';
import { ProsodyAnalyzer } from '../audio-processor/ProsodyAnalyzer';
import { TurnTakingTracker } from '../audio-processor/TurnTakingTracker';
import { FaceFrame } from '../video-processor/types';
import {
  MetricSnapshot,
  ParticipantMetrics,
  SessionMetrics,
  MetricConfig,
  StudentState,
  SESSION_TYPE_WEIGHTS,
  IDEAL_TALK_RATIOS,
} from './types';
import { EMA, RollingWindow, detectTrend, clamp } from '../utils/smoothing';

const DECAY_HALF_LIFE_MS = 120000; // 2 minutes — recent metrics weighted more

export class MetricsEngine {
  private config: MetricConfig;
  private tutorGaze = new GazeEstimator();
  private studentGaze = new GazeEstimator();
  private tutorExpression = new ExpressionAnalyzer();
  private studentExpression = new ExpressionAnalyzer();
  private speakingTracker = new SpeakingTimeTracker();
  private interruptionDetector = new InterruptionDetector();
  private tutorProsody = new ProsodyAnalyzer();
  private studentProsody = new ProsodyAnalyzer();
  private turnTakingTracker = new TurnTakingTracker();

  private tutorEyeContactWindow = new RollingWindow<boolean>(120); // 60s at 2Hz
  private studentEyeContactWindow = new RollingWindow<boolean>(120);
  private engagementHistory: number[] = [];
  private tutorEyeContactHistory: number[] = [];
  private studentEyeContactHistory: number[] = [];
  private studentStateHistory = new RollingWindow<StudentState>(20); // Last 10s

  private tutorSilenceStart: number | null = null;
  private studentSilenceStart: number | null = null;
  private sessionStartTime: number;

  private engagementEMA = new EMA(0.15); // Slightly less sticky than before

  // Baseline tracking (first 2 minutes)
  private baselineEngagement: number | null = null;
  private baselineSamples = 0;
  private baselineSum = 0;

  constructor(config: Partial<MetricConfig> = {}) {
    // Use session-type-aware weights if available
    const sessionType = config.sessionType || 'discussion';
    const typeWeights = SESSION_TYPE_WEIGHTS[sessionType];
    this.config = { ...typeWeights, ...config };
    this.sessionStartTime = Date.now();
  }

  update(
    tutorFace: FaceFrame | null,
    studentFace: FaceFrame | null,
    tutorSpeaking: boolean,
    studentSpeaking: boolean,
    tutorAudioEnergy: number,
    studentAudioEnergy: number,
    timestamp: number
  ): MetricSnapshot {
    // Video analysis
    const tutorGazeResult = tutorFace ? this.tutorGaze.estimate(tutorFace.landmarks) : null;
    const studentGazeResult = studentFace ? this.studentGaze.estimate(studentFace.landmarks) : null;
    const tutorExpr = tutorFace ? this.tutorExpression.analyze(tutorFace.landmarks, tutorFace.blendshapes) : null;
    const studentExpr = studentFace ? this.studentExpression.analyze(studentFace.landmarks, studentFace.blendshapes) : null;

    // Eye contact tracking (expanded to 120 samples = 60s)
    this.tutorEyeContactWindow.push(tutorGazeResult?.isLookingAtCamera ?? false);
    this.studentEyeContactWindow.push(studentGazeResult?.isLookingAtCamera ?? false);

    const tutorEyeContact = this.tutorEyeContactWindow.ratio(v => v);
    const studentEyeContact = this.studentEyeContactWindow.ratio(v => v);

    this.tutorEyeContactHistory.push(tutorEyeContact);
    this.studentEyeContactHistory.push(studentEyeContact);

    // Audio analysis
    this.speakingTracker.update(tutorSpeaking, studentSpeaking, timestamp);
    this.interruptionDetector.update(tutorSpeaking, studentSpeaking, timestamp);
    this.turnTakingTracker.update(tutorSpeaking, studentSpeaking, timestamp);
    this.tutorProsody.update(tutorAudioEnergy, tutorSpeaking);
    this.studentProsody.update(studentAudioEnergy, studentSpeaking);

    const speakingTime = this.speakingTracker.getResult();
    const tutorProsodyResult = this.tutorProsody.analyze();
    const studentProsodyResult = this.studentProsody.analyze();
    const turnTaking = this.turnTakingTracker.getResult();

    // Silence tracking
    if (tutorSpeaking) {
      this.tutorSilenceStart = null;
    } else if (this.tutorSilenceStart === null) {
      this.tutorSilenceStart = timestamp;
    }
    if (studentSpeaking) {
      this.studentSilenceStart = null;
    } else if (this.studentSilenceStart === null) {
      this.studentSilenceStart = timestamp;
    }

    // Energy: combine audio prosody + visual expression
    const tutorEnergy = clamp(
      (tutorProsodyResult.energyScore * 0.6) + ((tutorExpr?.energy ?? 0.5) * 0.4),
      0, 1
    );
    const studentEnergy = clamp(
      (studentProsodyResult.energyScore * 0.6) + ((studentExpr?.energy ?? 0.5) * 0.4),
      0, 1
    );

    const elapsedMs = timestamp - this.sessionStartTime;

    // Build participant metrics
    const tutor: ParticipantMetrics = {
      eyeContactScore: tutorEyeContact,
      talkTimePercent: speakingTime.tutor,
      energyScore: tutorEnergy,
      isSpeaking: tutorSpeaking,
      silenceDurationMs: this.tutorSilenceStart ? timestamp - this.tutorSilenceStart : 0,
      eyeContactTrend: detectTrend(this.tutorEyeContactHistory),
      pitchVariance: tutorProsodyResult.pitchVariance,
      speechRate: tutorProsodyResult.speechRate,
    };

    const student: ParticipantMetrics = {
      eyeContactScore: studentEyeContact,
      talkTimePercent: speakingTime.student,
      energyScore: studentEnergy,
      isSpeaking: studentSpeaking,
      silenceDurationMs: this.studentSilenceStart ? timestamp - this.studentSilenceStart : 0,
      eyeContactTrend: detectTrend(this.studentEyeContactHistory),
      pitchVariance: studentProsodyResult.pitchVariance,
      speechRate: studentProsodyResult.speechRate,
    };

    // Engagement score with temporal weighting
    const engagementRaw = this.computeEngagement(tutor, student, elapsedMs);
    const engagementSmoothed = this.engagementEMA.update(engagementRaw);
    this.engagementHistory.push(engagementSmoothed);

    // Update baseline (first 2 minutes)
    if (elapsedMs < 120000) {
      this.baselineSum += engagementSmoothed;
      this.baselineSamples++;
      this.baselineEngagement = this.baselineSum / this.baselineSamples;
    }

    // Student state machine — uses facial expression signals
    const studentState = this.classifyStudentState(student, studentExpr, engagementSmoothed, elapsedMs);
    this.studentStateHistory.push(studentState);

    // Attention drift: multi-signal detection
    const attentionDriftDetected =
      (student.eyeContactTrend === 'declining' && student.silenceDurationMs > 45000) ||
      (studentState === 'drifting' || studentState === 'struggling');

    const session: SessionMetrics = {
      interruptionCount: this.interruptionDetector.getCount(),
      silenceDurationCurrent: Math.max(tutor.silenceDurationMs, student.silenceDurationMs),
      engagementTrend: detectTrend(this.engagementHistory),
      attentionDriftDetected,
      elapsedMs,
      turnTakingGapMs: turnTaking.avgTurnGapMs,
      turnCount: turnTaking.turnCount,
      studentState,
    };

    return {
      timestamp,
      tutor,
      student,
      session,
      engagementScore: Math.round(engagementSmoothed * 100),
      studentState,
    };
  }

  private classifyStudentState(
    student: ParticipantMetrics,
    expression: import('../video-processor/types').ExpressionResult | null,
    engagement: number,
    elapsedMs: number
  ): StudentState {
    if (elapsedMs < 30000) return 'engaged';

    const eyeContactLow = student.eyeContactScore < 0.3;
    const silenceLong = student.silenceDurationMs > 60000;
    const energyLow = student.energyScore < 0.25;
    const engagementLow = engagement < 0.4;
    const eyeContactDeclining = student.eyeContactTrend === 'declining';

    // Use facial expression signals when available
    const confusion = expression?.confusion ?? 0;
    const concentration = expression?.concentration ?? 0;
    const smile = expression?.smile ?? 0;
    const browFurrow = expression?.browFurrow ?? 0;
    const headNod = expression?.headNod ?? 0;

    // Struggling: facial distress (high brow furrow + low valence) + silence + low engagement
    if ((energyLow && silenceLong && engagementLow) ||
        (browFurrow > 0.5 && confusion > 0.4 && silenceLong)) {
      return 'struggling';
    }

    // Confused: furrowed brows + squinting + not much talking (thinking hard)
    // Direct facial signal is the most reliable confused detector
    if (confusion > 0.45 && student.speechRate < 0.2) {
      return 'confused';
    }
    if (eyeContactLow && !silenceLong && student.energyScore > 0.3 && student.speechRate < 0.2 && browFurrow > 0.3) {
      return 'confused';
    }

    // Drifting: looking away + silence + no concentration face
    if (eyeContactDeclining && eyeContactLow && student.silenceDurationMs > 30000 && concentration < 0.3) {
      return 'drifting';
    }

    // Passive: low engagement but no negative facial signals
    if (engagementLow && student.talkTimePercent < 0.15 && !eyeContactDeclining && confusion < 0.2) {
      return 'passive';
    }

    // Engaged: nodding, smiling, good eye contact, or active concentration
    if (headNod > 0.3 || smile > 0.4 || concentration > 0.5) {
      return 'engaged';
    }

    return 'engaged';
  }

  private computeEngagement(tutor: ParticipantMetrics, student: ParticipantMetrics, elapsedMs: number): number {
    const c = this.config;
    const ideal = IDEAL_TALK_RATIOS[c.sessionType];

    // Eye contact: average of both participants
    const eyeContactScore = (tutor.eyeContactScore + student.eyeContactScore) / 2;

    // Speaking time: how close to ideal ratio
    const talkDeviation = Math.abs(tutor.talkTimePercent - ideal.tutor);
    const talkScore = 1 - Math.min(1, talkDeviation * 2);

    // Energy: weighted toward student (their engagement matters more)
    const energyScore = tutor.energyScore * 0.35 + student.energyScore * 0.65;

    // Interruptions: fewer is better
    const interruptionCount = this.interruptionDetector.getCount();
    const interruptionScore = Math.max(0, 1 - interruptionCount / 10);

    // Attention: multi-factor
    const attentionBase =
      student.eyeContactTrend === 'declining' ? 0.3 :
      student.eyeContactTrend === 'rising' ? 0.9 : 0.7;

    // Bonus for good turn-taking (indicates active dialogue)
    const turnBonus = elapsedMs > 60000 && this.turnTakingTracker.getResult().turnCount > 0
      ? Math.min(0.15, this.turnTakingTracker.getResult().turnCount / 40)
      : 0;

    const attentionScore = clamp(attentionBase + turnBonus, 0, 1);

    // Temporal weighting: recent samples matter more
    const temporalWeight = elapsedMs > 0
      ? 0.85 + 0.15 * Math.exp(-elapsedMs / DECAY_HALF_LIFE_MS)
      : 1;

    const raw = eyeContactScore * c.eyeContactWeight +
      talkScore * c.speakingTimeWeight +
      energyScore * c.energyWeight +
      interruptionScore * c.interruptionWeight +
      attentionScore * c.attentionWeight;

    return clamp(raw * temporalWeight, 0, 1);
  }

  getInterruptionDetector(): InterruptionDetector {
    return this.interruptionDetector;
  }

  getBaseline(): number | null {
    return this.baselineEngagement;
  }

  reset() {
    this.tutorGaze.reset();
    this.studentGaze.reset();
    this.tutorExpression.reset();
    this.studentExpression.reset();
    this.speakingTracker.reset();
    this.interruptionDetector.reset();
    this.tutorProsody.reset();
    this.studentProsody.reset();
    this.turnTakingTracker.reset();
    this.tutorEyeContactWindow.clear();
    this.studentEyeContactWindow.clear();
    this.engagementHistory = [];
    this.tutorEyeContactHistory = [];
    this.studentEyeContactHistory = [];
    this.studentStateHistory.clear();
    this.tutorSilenceStart = null;
    this.studentSilenceStart = null;
    this.engagementEMA.reset();
    this.baselineEngagement = null;
    this.baselineSamples = 0;
    this.baselineSum = 0;
    this.sessionStartTime = Date.now();
  }
}
