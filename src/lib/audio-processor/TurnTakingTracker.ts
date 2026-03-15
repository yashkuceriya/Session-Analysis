import { TurnTakingResult } from './types';

export class TurnTakingTracker {
  private lastSpeaker: 'tutor' | 'student' | null = null;
  private lastSpeakerEndTime: number | null = null;
  private turnGaps: number[] = [];
  private turnCount = 0;

  update(tutorSpeaking: boolean, studentSpeaking: boolean, timestamp: number) {
    const currentSpeaker = tutorSpeaking && !studentSpeaking ? 'tutor'
      : studentSpeaking && !tutorSpeaking ? 'student'
      : null;

    // Detect speaker change
    if (currentSpeaker && currentSpeaker !== this.lastSpeaker) {
      if (this.lastSpeaker !== null && this.lastSpeakerEndTime !== null) {
        const gap = timestamp - this.lastSpeakerEndTime;
        if (gap > 0 && gap < 30000) { // Ignore gaps > 30s (not a turn-take, just silence)
          this.turnGaps.push(gap);
          this.turnCount++;
        }
      }
      this.lastSpeaker = currentSpeaker;
    }

    // Track when current speaker stops
    if (currentSpeaker) {
      this.lastSpeakerEndTime = timestamp;
    }
  }

  getResult(): TurnTakingResult {
    const lastGap = this.turnGaps.length > 0 ? this.turnGaps[this.turnGaps.length - 1] : 0;
    const avgGap = this.turnGaps.length > 0
      ? this.turnGaps.reduce((a, b) => a + b, 0) / this.turnGaps.length
      : 0;

    return {
      lastTurnGapMs: lastGap,
      avgTurnGapMs: avgGap,
      turnCount: this.turnCount,
    };
  }

  reset() {
    this.lastSpeaker = null;
    this.lastSpeakerEndTime = null;
    this.turnGaps = [];
    this.turnCount = 0;
  }
}
