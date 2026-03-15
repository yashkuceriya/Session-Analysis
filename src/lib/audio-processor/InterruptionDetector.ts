import { InterruptionEvent } from './types';

const OVERLAP_THRESHOLD_MS = 500;

export class InterruptionDetector {
  private overlapStartTime: number | null = null;
  private firstSpeaker: 'tutor' | 'student' | null = null;
  private interruptions: InterruptionEvent[] = [];
  private lastTutorSpeaking = false;
  private lastStudentSpeaking = false;

  update(tutorSpeaking: boolean, studentSpeaking: boolean, timestamp: number) {
    const bothSpeaking = tutorSpeaking && studentSpeaking;

    if (bothSpeaking && !this.overlapStartTime) {
      this.overlapStartTime = timestamp;
      // Who was already speaking?
      if (this.lastTutorSpeaking && !this.lastStudentSpeaking) {
        this.firstSpeaker = 'tutor';
      } else if (this.lastStudentSpeaking && !this.lastTutorSpeaking) {
        this.firstSpeaker = 'student';
      } else {
        this.firstSpeaker = null;
      }
    } else if (!bothSpeaking && this.overlapStartTime) {
      const duration = timestamp - this.overlapStartTime;
      if (duration >= OVERLAP_THRESHOLD_MS && this.firstSpeaker) {
        this.interruptions.push({
          timestamp: this.overlapStartTime,
          interruptedBy: this.firstSpeaker === 'tutor' ? 'student' : 'tutor',
          durationMs: duration,
        });
      }
      this.overlapStartTime = null;
      this.firstSpeaker = null;
    }

    this.lastTutorSpeaking = tutorSpeaking;
    this.lastStudentSpeaking = studentSpeaking;
  }

  getCount(): number {
    return this.interruptions.length;
  }

  getRecent(windowMs: number, now: number): InterruptionEvent[] {
    return this.interruptions.filter(i => now - i.timestamp < windowMs);
  }

  getAll(): InterruptionEvent[] {
    return [...this.interruptions];
  }

  reset() {
    this.interruptions = [];
    this.overlapStartTime = null;
    this.firstSpeaker = null;
    this.lastTutorSpeaking = false;
    this.lastStudentSpeaking = false;
  }
}
