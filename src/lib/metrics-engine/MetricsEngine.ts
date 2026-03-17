import { GazeEstimator } from '../video-processor/GazeEstimator';
import { ExpressionAnalyzer } from '../video-processor/ExpressionAnalyzer';
import { SpeakingTimeTracker } from '../audio-processor/SpeakingTimeTracker';
import { InterruptionDetector } from '../audio-processor/InterruptionDetector';
import { ProsodyAnalyzer } from '../audio-processor/ProsodyAnalyzer';
import { TurnTakingTracker } from '../audio-processor/TurnTakingTracker';
import { TopicRelevanceTracker } from '../audio-processor/TopicRelevanceTracker';
import { FaceFrame } from '../video-processor/types';
import {
  MetricSnapshot,
  ParticipantMetrics,
  SessionMetrics,
  MetricConfig,
  StudentState,
  ExpressionSnapshot,
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
  private topicRelevanceTracker = new TopicRelevanceTracker();

  private tutorEyeContactWindow = new RollingWindow<boolean>(120); // 60s at 2Hz
  private studentEyeContactWindow = new RollingWindow<boolean>(120);
  private engagementHistory: number[] = [];
  private tutorEyeContactHistory: number[] = [];
  private studentEyeContactHistory: number[] = [];
  // Track actual face detections (separate from eye contact window which always gets pushed to)
  private tutorFaceDetections = new RollingWindow<boolean>(30); // Last 15s at 2Hz
  private studentFaceDetections = new RollingWindow<boolean>(30);
  private studentStateHistory = new RollingWindow<StudentState>(20); // Last 10s

  private tutorSilenceStart: number | null = null;
  private studentSilenceStart: number | null = null;
  private sessionStartTime: number;

  // Head movement and distraction tracking
  private tutorHeadPoseHistory: { pitch: number; yaw: number; roll: number }[] = [];
  private studentHeadPoseHistory: { pitch: number; yaw: number; roll: number }[] = [];
  private distractionWindow = new RollingWindow<number>(60); // 30s at 2Hz
  private focusStreakStart: number = 0;
  private longestFocusStreak: number = 0;
  private distractionEventCount: number = 0;
  private lastDistracted: boolean = false;

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
    this.focusStreakStart = Date.now();
  }

  /**
   * Set the session topic for relevance tracking
   */
  setTopic(subject: string) {
    this.topicRelevanceTracker.setTopic(subject);
  }

  /**
   * Process a transcript segment for topic relevance tracking
   */
  processTranscript(text: string) {
    this.topicRelevanceTracker.processTranscript(text);
  }

  private computeHeadMovement(
    history: { pitch: number; yaw: number; roll: number }[],
    currentPose: { pitch: number; yaw: number; roll: number }
  ): number {
    history.push(currentPose);
    if (history.length > 30) history.splice(0, history.length - 30);
    if (history.length < 2) return 0;

    let totalMovement = 0;
    for (let i = 1; i < history.length; i++) {
      totalMovement += Math.abs(history[i].pitch - history[i - 1].pitch) +
                       Math.abs(history[i].yaw - history[i - 1].yaw) +
                       Math.abs(history[i].roll - history[i - 1].roll);
    }
    return Math.min(1, totalMovement / (history.length * 0.1));
  }

  private computeDistraction(
    gazeDeviation: number,
    eyeContact: number,
    headMovement: number,
    expression: import('../video-processor/types').ExpressionResult | null
  ): number {
    const gazeWeight = 0.35;
    const eyeContactWeight = 0.30;
    const movementWeight = 0.20;
    const expressionWeight = 0.15;

    const expressionDistraction = expression
      ? (1 - expression.concentration) * 0.5 + (expression.confusion * 0.3) + (1 - (expression.interest ?? 0.5)) * 0.2
      : 0.5;

    return Math.min(1,
      gazeDeviation * gazeWeight +
      (1 - eyeContact) * eyeContactWeight +
      headMovement * movementWeight +
      expressionDistraction * expressionWeight
    );
  }

  private estimatePosture(headTilt: number, pitch: number): 'upright' | 'leaning' | 'slouching' {
    if (Math.abs(headTilt) > 0.3 || pitch > 0.2) return 'slouching';
    if (Math.abs(headTilt) > 0.15 || Math.abs(pitch) > 0.1) return 'leaning';
    return 'upright';
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

    // Track whether face was actually detected this frame
    this.tutorFaceDetections.push(tutorGazeResult !== null);
    this.studentFaceDetections.push(studentGazeResult !== null);

    // Eye contact tracking — only push when face is detected (avoid polluting window with false negatives)
    if (tutorGazeResult) {
      this.tutorEyeContactWindow.push(tutorGazeResult.isLookingAtCamera);
    }
    if (studentGazeResult) {
      this.studentEyeContactWindow.push(studentGazeResult.isLookingAtCamera);
    }

    const tutorEyeContact = this.tutorEyeContactWindow.length > 0
      ? this.tutorEyeContactWindow.ratio(v => v) : 0;
    const studentEyeContact = this.studentEyeContactWindow.length > 0
      ? this.studentEyeContactWindow.ratio(v => v) : 0;

    this.tutorEyeContactHistory.push(tutorEyeContact);
    if (this.tutorEyeContactHistory.length > 600) {
      this.tutorEyeContactHistory = this.tutorEyeContactHistory.slice(-300);
    }
    this.studentEyeContactHistory.push(studentEyeContact);
    if (this.studentEyeContactHistory.length > 600) {
      this.studentEyeContactHistory = this.studentEyeContactHistory.slice(-300);
    }

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

    // Head movement and distraction metrics
    const tutorHeadMovement = tutorExpr ? this.computeHeadMovement(this.tutorHeadPoseHistory, {
      pitch: tutorExpr.headTilt, // Use headTilt as proxy for pitch
      yaw: 0,
      roll: tutorExpr.headTilt,
    }) : 0;

    const studentHeadMovement = studentExpr ? this.computeHeadMovement(this.studentHeadPoseHistory, {
      pitch: studentExpr.headTilt,
      yaw: 0,
      roll: studentExpr.headTilt,
    }) : 0;

    const tutorGazeDeviation = tutorGazeResult?.deviation ?? 0;
    const studentGazeDeviation = studentGazeResult?.deviation ?? 0;

    const tutorDistraction = this.computeDistraction(
      tutorGazeDeviation,
      tutorEyeContact,
      tutorHeadMovement,
      tutorExpr
    );

    const studentDistraction = this.computeDistraction(
      studentGazeDeviation,
      studentEyeContact,
      studentHeadMovement,
      studentExpr
    );

    // Blink rate (blinks per minute)
    const tutorBlinkRate = this.tutorGaze.getBlinkRate();
    const studentBlinkRate = this.studentGaze.getBlinkRate();

    // Posture estimation
    const tutorPosture = tutorExpr ? this.estimatePosture(tutorExpr.headTilt, tutorExpr.browFurrow) : 'upright';
    const studentPosture = studentExpr ? this.estimatePosture(studentExpr.headTilt, studentExpr.browFurrow) : 'upright';

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
      headMovement: tutorHeadMovement,
      blinkRate: tutorBlinkRate,
      distractionScore: tutorDistraction,
      gazeDeviation: tutorGazeDeviation,
      posture: tutorPosture,
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
      headMovement: studentHeadMovement,
      blinkRate: studentBlinkRate,
      distractionScore: studentDistraction,
      gazeDeviation: studentGazeDeviation,
      posture: studentPosture,
    };

    // Engagement score with temporal weighting
    const engagementRaw = this.computeEngagement(tutor, student, elapsedMs);
    const engagementSmoothed = this.engagementEMA.update(engagementRaw);
    this.engagementHistory.push(engagementSmoothed);
    if (this.engagementHistory.length > 600) {
      this.engagementHistory = this.engagementHistory.slice(-300);
    }

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
      (student.eyeContactTrend === 'declining' && student.silenceDurationMs > 10000) ||
      (studentState === 'drifting' || studentState === 'struggling');

    // Focus streak tracking
    const isDistracted = studentDistraction > 0.6;
    if (!isDistracted) {
      if (this.lastDistracted) {
        this.focusStreakStart = timestamp;
      }
      const currentStreak = timestamp - this.focusStreakStart;
      if (currentStreak > this.longestFocusStreak) {
        this.longestFocusStreak = currentStreak;
      }
    } else {
      if (!this.lastDistracted) {
        this.distractionEventCount++;
      }
    }
    this.lastDistracted = isDistracted;
    this.distractionWindow.push(studentDistraction);

    // Average distraction in session
    const avgDistraction = this.distractionWindow.length > 0
      ? this.distractionWindow.average(d => d)
      : 0;

    const session: SessionMetrics = {
      interruptionCount: this.interruptionDetector.getCount(),
      silenceDurationCurrent: Math.max(tutor.silenceDurationMs, student.silenceDurationMs),
      engagementTrend: detectTrend(this.engagementHistory),
      attentionDriftDetected,
      elapsedMs,
      turnTakingGapMs: turnTaking.avgTurnGapMs,
      turnCount: turnTaking.turnCount,
      studentState,
      avgDistraction,
      focusStreakMs: this.longestFocusStreak,
      distractionEvents: this.distractionEventCount,
      topicRelevanceScore: this.topicRelevanceTracker.getRelevanceScore(),
    };

    // Helper to convert ExpressionResult to ExpressionSnapshot
    const toExpressionSnapshot = (expr: import('../video-processor/types').ExpressionResult | null): ExpressionSnapshot | null => {
      if (!expr) return null;
      return {
        smile: expr.smile,
        confusion: expr.confusion,
        concentration: expr.concentration,
        surprise: expr.surprise,
        energy: expr.energy,
        valence: expr.valence,
        browFurrow: expr.browFurrow,
        browRaise: expr.browRaise,
        headNod: expr.headNod,
        headShake: expr.headShake,
        mouthOpen: expr.mouthOpen,
        headTilt: expr.headTilt,
        frustration: expr.frustration,
        interest: expr.interest,
      };
    };

    return {
      timestamp,
      tutor,
      student,
      session,
      engagementScore: Math.round(engagementSmoothed * 100),
      studentState,
      tutorExpression: toExpressionSnapshot(tutorExpr),
      studentExpression: toExpressionSnapshot(studentExpr),
    };
  }

  private classifyStudentState(
    student: ParticipantMetrics,
    expression: import('../video-processor/types').ExpressionResult | null,
    engagement: number,
    elapsedMs: number
  ): StudentState {
    if (elapsedMs < 8000) return 'engaged'; // Brief warmup before classifying

    const eyeContactLow = student.eyeContactScore < 0.3;
    const silenceLong = student.silenceDurationMs > 15000;
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
    if (confusion > 0.35 && student.speechRate < 0.2) {
      return 'confused';
    }
    if (confusion > 0.3 && browFurrow > 0.25) {
      return 'confused';
    }
    if (eyeContactLow && !silenceLong && student.energyScore > 0.3 && student.speechRate < 0.2 && browFurrow > 0.3) {
      return 'confused';
    }

    // Drifting: looking away + silence + no concentration face
    if (eyeContactDeclining && eyeContactLow && student.silenceDurationMs > 8000 && concentration < 0.3) {
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

    // Detect whether face data is actually available (at least 20% face detection rate in recent window)
    const tutorFaceRate = this.tutorFaceDetections.length > 0
      ? this.tutorFaceDetections.ratio(v => v) : 0;
    const studentFaceRate = this.studentFaceDetections.length > 0
      ? this.studentFaceDetections.ratio(v => v) : 0;
    const hasTutorFace = tutorFaceRate > 0.2;
    const hasStudentFace = studentFaceRate > 0.2;
    const hasFaceData = hasTutorFace || hasStudentFace;

    // Eye contact: average of both participants (default to 0.5 if no face data)
    const tutorEye = hasTutorFace ? tutor.eyeContactScore : 0.5;
    const studentEye = hasStudentFace ? student.eyeContactScore : 0.5;
    const eyeContactScore = (tutorEye + studentEye) / 2;

    // Speaking time: how close to ideal ratio
    const talkDeviation = Math.abs(tutor.talkTimePercent - ideal.tutor);
    const talkScore = 1 - Math.min(1, talkDeviation * 2);

    // Energy: weighted toward student (their engagement matters more)
    // Default to moderate energy when face data unavailable
    const tutorEnergy = hasTutorFace ? tutor.energyScore : Math.max(tutor.energyScore, 0.4);
    const studentEnergy = hasStudentFace ? student.energyScore : Math.max(student.energyScore, 0.4);
    const energyScore = tutorEnergy * 0.35 + studentEnergy * 0.65;

    // Interruptions: fewer is better (scaled to reasonable range)
    const interruptionCount = this.interruptionDetector.getCount();
    const interruptionScore = Math.max(0, 1 - interruptionCount / 20);

    // Attention: multi-factor
    const attentionBase = !hasFaceData ? 0.6 : // Neutral when no face data
      student.eyeContactTrend === 'declining' ? 0.3 :
      student.eyeContactTrend === 'rising' ? 0.9 : 0.7;

    // Bonus for good turn-taking (indicates active dialogue)
    const turnBonus = elapsedMs > 30000 && this.turnTakingTracker.getResult().turnCount > 0
      ? Math.min(0.15, this.turnTakingTracker.getResult().turnCount / 30)
      : 0;

    const attentionScore = clamp(attentionBase + turnBonus, 0, 1);

    // Temporal weighting: recent samples matter more
    const temporalWeight = elapsedMs > 0
      ? 0.85 + 0.15 * Math.exp(-elapsedMs / DECAY_HALF_LIFE_MS)
      : 1;

    // Adjust weights when face data is unavailable — rely more on audio signals
    let eyeWeight = c.eyeContactWeight;
    let speakingWeight = c.speakingTimeWeight;
    let energyWeight = c.energyWeight;
    const interruptionWeight = c.interruptionWeight;
    let attentionWeight = c.attentionWeight;

    if (!hasFaceData) {
      // Redistribute eye contact weight to other signals
      const redistributed = eyeWeight * 0.5;
      eyeWeight *= 0.5; // Still use default 0.5 eye contact
      speakingWeight += redistributed * 0.4;
      energyWeight += redistributed * 0.3;
      attentionWeight += redistributed * 0.3;
    }

    const raw = eyeContactScore * eyeWeight +
      talkScore * speakingWeight +
      energyScore * energyWeight +
      interruptionScore * interruptionWeight +
      attentionScore * attentionWeight;

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
    this.tutorHeadPoseHistory = [];
    this.studentHeadPoseHistory = [];
    this.distractionWindow.clear();
    this.focusStreakStart = Date.now();
    this.longestFocusStreak = 0;
    this.distractionEventCount = 0;
    this.lastDistracted = false;
    this.sessionStartTime = Date.now();
  }
}
