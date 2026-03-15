export interface VADResult {
  isSpeaking: boolean;
  energy: number;
  timestamp: number;
}

export interface SpeakingTimeResult {
  tutor: number; // percentage 0-1
  student: number;
  tutorTotalMs: number;
  studentTotalMs: number;
}

export interface InterruptionEvent {
  timestamp: number;
  interruptedBy: 'tutor' | 'student';
  durationMs: number;
}

export interface ProsodyResult {
  volumeVariance: number;
  avgVolume: number;
  energyScore: number; // 0-1
  pitchEstimate: number; // Hz, 0 if not available
  pitchVariance: number; // Higher = more expressive
  speechRate: number; // Active speech frames per window
}

export interface TurnTakingResult {
  lastTurnGapMs: number; // Gap between last speaker switch
  avgTurnGapMs: number;
  turnCount: number;
}
