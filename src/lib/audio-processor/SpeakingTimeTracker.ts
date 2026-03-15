import { SpeakingTimeResult } from './types';

export class SpeakingTimeTracker {
  private tutorSpeakingMs = 0;
  private studentSpeakingMs = 0;
  private lastUpdateTime: number | null = null;
  private lastTutorSpeaking = false;
  private lastStudentSpeaking = false;

  update(tutorSpeaking: boolean, studentSpeaking: boolean, timestamp: number) {
    if (this.lastUpdateTime !== null) {
      const deltaMs = timestamp - this.lastUpdateTime;
      if (deltaMs > 0 && deltaMs <= 2000) { // Sanity check: ignore gaps >2s
        if (this.lastTutorSpeaking) this.tutorSpeakingMs += deltaMs;
        if (this.lastStudentSpeaking) this.studentSpeakingMs += deltaMs;
      }
    }
    this.lastTutorSpeaking = tutorSpeaking;
    this.lastStudentSpeaking = studentSpeaking;
    this.lastUpdateTime = timestamp;
  }

  getResult(): SpeakingTimeResult {
    const total = this.tutorSpeakingMs + this.studentSpeakingMs;
    if (total === 0) return { tutor: 0.5, student: 0.5, tutorTotalMs: 0, studentTotalMs: 0 };

    return {
      tutor: this.tutorSpeakingMs / total,
      student: this.studentSpeakingMs / total,
      tutorTotalMs: this.tutorSpeakingMs,
      studentTotalMs: this.studentSpeakingMs,
    };
  }

  reset() {
    this.tutorSpeakingMs = 0;
    this.studentSpeakingMs = 0;
    this.lastUpdateTime = null;
    this.lastTutorSpeaking = false;
    this.lastStudentSpeaking = false;
  }
}
