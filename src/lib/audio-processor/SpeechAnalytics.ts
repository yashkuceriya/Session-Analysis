import { RollingWindow } from '../utils/smoothing';

/**
 * Advanced speech analysis including WPM, filler words, questions, and confidence scoring
 */
export class SpeechAnalytics {
  // Running statistics
  private wpmHistory = new RollingWindow<number>(30);
  private fillerRateHistory = new RollingWindow<number>(30);
  private questionRateHistory = new RollingWindow<number>(30);
  private latencyHistory = new RollingWindow<number>(100);

  // Filler word counts
  private totalFillerWords = 0;
  private fillerWordTimestamps: number[] = [];

  private readonly COMMON_FILLERS = ['um', 'uh', 'like', 'you know', 'basically', 'so', 'right', 'actually'];
  private readonly QUESTION_STARTERS = ['what', 'why', 'how', 'who', 'when', 'where', 'which', 'could', 'would', 'can', 'will', 'do', 'does', 'did', 'is', 'are', 'am'];

  /**
   * Analyze speech rate from audio buffer using syllable detection
   * Returns words per minute based on energy peaks
   */
  analyzeSpeechRate(audioBuffer: Float32Array, sampleRate: number): number {
    if (audioBuffer.length < sampleRate * 0.1) return 0; // Need at least 100ms

    // Detect syllables (energy peaks) in the audio
    const syllableCount = this.detectSyllables(audioBuffer, sampleRate);
    const durationSeconds = audioBuffer.length / sampleRate;
    const durationMinutes = durationSeconds / 60;

    // Average ratio of syllables-to-words is ~2.5 for English
    const estimatedWords = Math.max(1, Math.round(syllableCount / 2.5));
    const wpm = Math.round(estimatedWords / durationMinutes);

    this.wpmHistory.push(wpm);
    return wpm;
  }

  /**
   * Detect filler words in transcript text
   */
  detectFillerWords(transcript: string): { count: number; words: string[]; density: number } {
    const lowerTranscript = transcript.toLowerCase();
    const foundFillers: string[] = [];

    for (const filler of this.COMMON_FILLERS) {
      // Use word boundaries to avoid matching substrings
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lowerTranscript.match(regex);
      if (matches) {
        foundFillers.push(...matches);
      }
    }

    // Update running statistics
    const newFillerCount = foundFillers.length;
    this.totalFillerWords += newFillerCount;
    this.fillerWordTimestamps.push(...Array(newFillerCount).fill(Date.now()));

    // Clean up old timestamps (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.fillerWordTimestamps = this.fillerWordTimestamps.filter(t => t > fiveMinutesAgo);

    // Density: fillers per word
    const words = transcript.match(/\b\w+\b/g) || [];
    const density = words.length > 0 ? newFillerCount / words.length : 0;

    this.fillerRateHistory.push(density);

    return {
      count: newFillerCount,
      words: foundFillers,
      density: Math.min(1, density),
    };
  }

  /**
   * Detect questions in transcript
   */
  detectQuestions(transcript: string): { isQuestion: boolean; type: 'open' | 'closed' | 'rhetorical' } {
    const trimmed = transcript.trim();
    const lowerTranscript = trimmed.toLowerCase();

    // Check for question mark
    const hasQuestionMark = trimmed.endsWith('?');

    // Check for question starters
    const startsWithQuestionWord = this.QUESTION_STARTERS.some(starter =>
      lowerTranscript.startsWith(starter)
    );

    if (!hasQuestionMark && !startsWithQuestionWord) {
      return { isQuestion: false, type: 'closed' };
    }

    // Classify question type
    let type: 'open' | 'closed' | 'rhetorical' = 'closed';

    // Open-ended questions
    if (startsWithQuestionWord) {
      const firstWord = lowerTranscript.split(/\s+/)[0];
      if (['what', 'why', 'how', 'who', 'when', 'where'].includes(firstWord)) {
        type = 'open';
      }
    }

    // Rhetorical questions (contain statements or are self-answering)
    if (lowerTranscript.includes('isn\'t it') ||
        lowerTranscript.includes('don\'t you') ||
        lowerTranscript.includes('right?') ||
        lowerTranscript.includes('you know?')) {
      type = 'rhetorical';
    }

    return { isQuestion: true, type };
  }

  /**
   * Measure response latency from speaker timeline
   * Timeline is array of { speaker, startMs, endMs }
   */
  measureResponseLatency(
    speakerTimeline: Array<{ speaker: string; startMs: number; endMs: number }>
  ): { avgLatencyMs: number; latencies: number[] } {
    const latencies: number[] = [];

    for (let i = 1; i < speakerTimeline.length; i++) {
      const prevEnd = speakerTimeline[i - 1].endMs;
      const currStart = speakerTimeline[i].startMs;
      const gap = currStart - prevEnd;

      if (gap > 0 && gap < 10000) { // Ignore long pauses (likely not response latency)
        latencies.push(gap);
        this.latencyHistory.push(gap);
      }
    }

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    return { avgLatencyMs: avgLatency, latencies };
  }

  /**
   * Estimate confidence from prosody features
   * Higher pitch variance + moderate volume + steady rate = confident
   */
  getConfidenceScore(prosodyFeatures: {
    pitchVariance: number;
    volume: number;
    speechRate: number;
  }): number {
    // Normalize inputs
    const pitchVarianceNorm = Math.min(1, prosodyFeatures.pitchVariance / 50); // Typical variance is 50-150Hz
    const volumeNorm = Math.min(1, prosodyFeatures.volume); // Already 0-1
    const speechRateNorm = Math.min(1, prosodyFeatures.speechRate / 200); // Normal WPM is 100-200

    // Confident speakers have:
    // - Higher pitch variance (expressive, not monotone)
    // - Moderate to high volume (not tentative)
    // - Steady speech rate (not halting)

    const varianceScore = Math.min(1, pitchVarianceNorm * 1.2); // Reward expressiveness
    const volumeScore = volumeNorm > 0.3 ? volumeNorm : volumeNorm * 0.5; // Penalty for too quiet
    const rateScore = speechRateNorm > 0.7 && speechRateNorm < 1.1 ? 1 : 0.6; // Optimal range

    const confidence = (varianceScore * 0.4) + (volumeScore * 0.35) + (rateScore * 0.25);
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Get average speech rate (WPM) over recent window
   */
  getAverageSpeechRate(): number {
    if (this.wpmHistory.length === 0) return 0;
    const wpmValues = this.wpmHistory.getAll();
    return Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length);
  }

  /**
   * Get average filler rate (density) over recent window
   */
  getAverageFillerRate(): number {
    if (this.fillerRateHistory.length === 0) return 0;
    const rates = this.fillerRateHistory.getAll();
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }

  /**
   * Get average question rate (questions per minute of speech)
   */
  getAverageQuestionRate(): number {
    if (this.questionRateHistory.length === 0) return 0;
    const rates = this.questionRateHistory.getAll();
    return rates.reduce((a, b) => a + b, 0) / rates.length;
  }

  /**
   * Get average response latency (ms)
   */
  getAverageResponseLatency(): number {
    if (this.latencyHistory.length === 0) return 0;
    const latencies = this.latencyHistory.getAll();
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.wpmHistory.clear();
    this.fillerRateHistory.clear();
    this.questionRateHistory.clear();
    this.latencyHistory.clear();
    this.totalFillerWords = 0;
    this.fillerWordTimestamps = [];
  }

  /**
   * Internal: detect syllables from audio energy peaks
   */
  private detectSyllables(audioBuffer: Float32Array, sampleRate: number): number {
    // Simple energy peak detection for syllables
    const frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    const hopSize = Math.floor(sampleRate * 0.01); // 10ms hop
    const peaks: number[] = [];

    for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
      let energy = 0;
      for (let j = 0; j < frameSize; j++) {
        energy += audioBuffer[i + j] * audioBuffer[i + j];
      }
      energy = Math.sqrt(energy / frameSize);
      peaks.push(energy);
    }

    // Find local maxima (syllable nuclei)
    let syllableCount = 0;
    const threshold = this.computeEnergyThreshold(peaks);

    for (let i = 1; i < peaks.length - 1; i++) {
      if (
        peaks[i] > threshold &&
        peaks[i] > peaks[i - 1] &&
        peaks[i] > peaks[i + 1]
      ) {
        syllableCount++;
      }
    }

    return Math.max(1, syllableCount); // At least 1 syllable
  }

  /**
   * Compute adaptive energy threshold for peak detection
   */
  private computeEnergyThreshold(energies: number[]): number {
    if (energies.length === 0) return 0.01;

    const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
    const variance = energies.reduce((sum, e) => sum + (e - mean) ** 2, 0) / energies.length;
    const stdDev = Math.sqrt(variance);

    return mean + 0.5 * stdDev; // 0.5 std above mean
  }

  /**
   * Record question for running statistics
   */
  recordQuestion(transcript: string, durationMs: number) {
    const { isQuestion } = this.detectQuestions(transcript);
    if (isQuestion) {
      const questionsPerMinute = (1 / (durationMs / 60000));
      this.questionRateHistory.push(questionsPerMinute);
    }
  }
}
