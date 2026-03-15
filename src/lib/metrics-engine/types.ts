export type StudentState = 'engaged' | 'passive' | 'confused' | 'drifting' | 'struggling';

export interface ExpressionSnapshot {
  smile: number;        // 0-1
  confusion: number;    // 0-1
  concentration: number; // 0-1
  surprise: number;     // 0-1
  energy: number;       // 0-1
  valence: number;      // 0-1
  browFurrow: number;   // 0-1
  browRaise: number;    // 0-1
  headNod: number;      // -1 to 1
  headShake: number;    // 0-1
  mouthOpen: number;    // 0-1
  headTilt: number;     // radians
}

export interface MetricSnapshot {
  timestamp: number;
  tutor: ParticipantMetrics;
  student: ParticipantMetrics;
  session: SessionMetrics;
  engagementScore: number; // 0-100
  studentState: StudentState;
  tutorExpression: ExpressionSnapshot | null;
  studentExpression: ExpressionSnapshot | null;
}

export interface ParticipantMetrics {
  eyeContactScore: number; // 0-1
  talkTimePercent: number; // 0-1
  energyScore: number; // 0-1
  isSpeaking: boolean;
  silenceDurationMs: number;
  eyeContactTrend: 'rising' | 'stable' | 'declining';
  pitchVariance: number; // Higher = more expressive
  speechRate: number; // 0-1, fraction of time speaking in recent window
}

export interface SessionMetrics {
  interruptionCount: number;
  silenceDurationCurrent: number;
  engagementTrend: 'rising' | 'stable' | 'declining';
  attentionDriftDetected: boolean;
  elapsedMs: number;
  turnTakingGapMs: number;
  turnCount: number;
  studentState: StudentState;
}

export type SessionType = 'lecture' | 'practice' | 'discussion';

export interface MetricConfig {
  sessionType: SessionType;
  eyeContactWeight: number;
  speakingTimeWeight: number;
  energyWeight: number;
  interruptionWeight: number;
  attentionWeight: number;
}

export const DEFAULT_METRIC_CONFIG: MetricConfig = {
  sessionType: 'discussion',
  eyeContactWeight: 0.25,
  speakingTimeWeight: 0.25,
  energyWeight: 0.20,
  interruptionWeight: 0.15,
  attentionWeight: 0.15,
};

// Session-type-aware weights
export const SESSION_TYPE_WEIGHTS: Record<SessionType, MetricConfig> = {
  lecture: {
    sessionType: 'lecture',
    eyeContactWeight: 0.30,
    speakingTimeWeight: 0.15,
    energyWeight: 0.25,
    interruptionWeight: 0.10,
    attentionWeight: 0.20,
  },
  practice: {
    sessionType: 'practice',
    eyeContactWeight: 0.20,
    speakingTimeWeight: 0.30,
    energyWeight: 0.15,
    interruptionWeight: 0.15,
    attentionWeight: 0.20,
  },
  discussion: {
    sessionType: 'discussion',
    eyeContactWeight: 0.25,
    speakingTimeWeight: 0.25,
    energyWeight: 0.20,
    interruptionWeight: 0.15,
    attentionWeight: 0.15,
  },
};

export const IDEAL_TALK_RATIOS: Record<SessionType, { tutor: number; student: number }> = {
  lecture: { tutor: 0.75, student: 0.25 },
  practice: { tutor: 0.40, student: 0.60 },
  discussion: { tutor: 0.50, student: 0.50 },
};
