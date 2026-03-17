import { VADResult } from './types';

const HANGOVER_MS = 200;
const ENERGY_THRESHOLD_RATIO = 0.15;
const BASELINE_FLOOR = 0.01;

export class VoiceActivityDetector {
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;
  private isSpeaking = false;
  private lastSpeechTime = 0;
  private maxRecentEnergy = BASELINE_FLOOR;
  private energyDecay = 0.995;

  setup(audioContext: AudioContext, source: MediaStreamAudioSourceNode): AnalyserNode {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.3;
    source.connect(this.analyser);
    this.dataArray = new Float32Array(this.analyser.fftSize);
    return this.analyser;
  }

  detect(timestamp: number): VADResult {
    if (!this.analyser || !this.dataArray) {
      return { isSpeaking: false, energy: 0, timestamp };
    }

    this.analyser.getFloatTimeDomainData(this.dataArray as Float32Array<ArrayBuffer>);

    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sumSquares += this.dataArray[i] * this.dataArray[i];
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);

    // Update max energy with decay
    this.maxRecentEnergy = Math.max(rms, this.maxRecentEnergy * this.energyDecay);
    this.maxRecentEnergy = Math.max(this.maxRecentEnergy, BASELINE_FLOOR);
    this.maxRecentEnergy = Math.min(this.maxRecentEnergy, 0.5);

    const threshold = ENERGY_THRESHOLD_RATIO * this.maxRecentEnergy + BASELINE_FLOOR * 0.5;
    const isAboveThreshold = rms > threshold;

    if (isAboveThreshold) {
      this.isSpeaking = true;
      this.lastSpeechTime = timestamp;
    } else if (this.isSpeaking && timestamp - this.lastSpeechTime > HANGOVER_MS) {
      this.isSpeaking = false;
    }

    return {
      isSpeaking: this.isSpeaking,
      energy: Math.min(1, rms / Math.max(this.maxRecentEnergy, BASELINE_FLOOR)),
      timestamp,
    };
  }

  reset() {
    this.isSpeaking = false;
    this.lastSpeechTime = 0;
    this.maxRecentEnergy = BASELINE_FLOOR;
  }
}
