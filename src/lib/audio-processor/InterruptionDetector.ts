import { InterruptionEvent } from './types';

const OVERLAP_THRESHOLD_MS = 1500;   // Overlap must last 1.5s to count (was 500ms — too sensitive)
const MIN_GAP_BETWEEN_MS = 3000;     // Minimum 3s gap between counting new interruptions
const MAX_INTERRUPTIONS_PER_MIN = 8; // Cap to prevent runaway counting

export class InterruptionDetector {
  private overlapStartTime: number | null = null;
  private firstSpeaker: 'tutor' | 'student' | null = null;
  private interruptions: InterruptionEvent[] = [];
  private lastTutorSpeaking = false;
  private lastStudentSpeaking = false;
  private lastInterruptionTime = 0;

  // Debounce: smooth out rapid VAD toggling
  private tutorSpeakingDebounced = false;
  private studentSpeakingDebounced = false;
  private tutorSpeakingSince = 0;
  private studentSpeakingSince = 0;
  private tutorSilentSince = 0;
  private studentSilentSince = 0;

  private static readonly DEBOUNCE_ON_MS = 300;   // Must speak for 300ms to count
  private static readonly DEBOUNCE_OFF_MS = 500;   // Must be silent for 500ms to count as stopped

  update(tutorSpeaking: boolean, studentSpeaking: boolean, timestamp: number) {
    // Debounce tutor speaking state
    if (tutorSpeaking && !this.tutorSpeakingDebounced) {
      if (this.tutorSpeakingSince === 0) this.tutorSpeakingSince = timestamp;
      if (timestamp - this.tutorSpeakingSince >= InterruptionDetector.DEBOUNCE_ON_MS) {
        this.tutorSpeakingDebounced = true;
        this.tutorSilentSince = 0;
      }
    } else if (!tutorSpeaking && this.tutorSpeakingDebounced) {
      if (this.tutorSilentSince === 0) this.tutorSilentSince = timestamp;
      if (timestamp - this.tutorSilentSince >= InterruptionDetector.DEBOUNCE_OFF_MS) {
        this.tutorSpeakingDebounced = false;
        this.tutorSpeakingSince = 0;
      }
    } else if (tutorSpeaking) {
      this.tutorSilentSince = 0;
    } else {
      this.tutorSpeakingSince = 0;
    }

    // Debounce student speaking state
    if (studentSpeaking && !this.studentSpeakingDebounced) {
      if (this.studentSpeakingSince === 0) this.studentSpeakingSince = timestamp;
      if (timestamp - this.studentSpeakingSince >= InterruptionDetector.DEBOUNCE_ON_MS) {
        this.studentSpeakingDebounced = true;
        this.studentSilentSince = 0;
      }
    } else if (!studentSpeaking && this.studentSpeakingDebounced) {
      if (this.studentSilentSince === 0) this.studentSilentSince = timestamp;
      if (timestamp - this.studentSilentSince >= InterruptionDetector.DEBOUNCE_OFF_MS) {
        this.studentSpeakingDebounced = false;
        this.studentSpeakingSince = 0;
      }
    } else if (studentSpeaking) {
      this.studentSilentSince = 0;
    } else {
      this.studentSpeakingSince = 0;
    }

    const tutorActive = this.tutorSpeakingDebounced;
    const studentActive = this.studentSpeakingDebounced;
    const bothSpeaking = tutorActive && studentActive;

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
      const timeSinceLastInterruption = timestamp - this.lastInterruptionTime;

      if (
        duration >= OVERLAP_THRESHOLD_MS &&
        this.firstSpeaker &&
        timeSinceLastInterruption >= MIN_GAP_BETWEEN_MS
      ) {
        // Rate limit: check interruptions in the last minute
        const oneMinAgo = timestamp - 60000;
        const recentCount = this.interruptions.filter(i => i.timestamp > oneMinAgo).length;

        if (recentCount < MAX_INTERRUPTIONS_PER_MIN) {
          this.interruptions.push({
            timestamp: this.overlapStartTime,
            interruptedBy: this.firstSpeaker === 'tutor' ? 'student' : 'tutor',
            durationMs: duration,
          });
          this.lastInterruptionTime = timestamp;
        }
      }
      this.overlapStartTime = null;
      this.firstSpeaker = null;
    }

    this.lastTutorSpeaking = tutorActive;
    this.lastStudentSpeaking = studentActive;
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
    this.lastInterruptionTime = 0;
    this.tutorSpeakingDebounced = false;
    this.studentSpeakingDebounced = false;
    this.tutorSpeakingSince = 0;
    this.studentSpeakingSince = 0;
    this.tutorSilentSince = 0;
    this.studentSilentSince = 0;
  }
}
