import { ProsodyResult } from './types';
import { RollingWindow } from '../utils/smoothing';

export class ProsodyAnalyzer {
  private volumeWindow = new RollingWindow<number>(100); // ~10 seconds at 10Hz
  private pitchWindow = new RollingWindow<number>(50); // ~5 seconds
  private speechFrameWindow = new RollingWindow<boolean>(100); // 10s for speech rate

  update(energy: number, isSpeaking?: boolean) {
    this.volumeWindow.push(energy);
    if (isSpeaking !== undefined) {
      this.speechFrameWindow.push(isSpeaking);
    }
  }

  updatePitch(frequencyData: Float32Array | null, sampleRate: number) {
    if (!frequencyData) return;
    const pitch = this.estimatePitch(frequencyData, sampleRate);
    if (pitch > 60 && pitch < 500) { // Valid human voice range
      this.pitchWindow.push(pitch);
    }
  }

  private estimatePitch(frequencyData: Float32Array, sampleRate: number): number {
    // Simple autocorrelation-based pitch detection
    const bufferSize = frequencyData.length;
    const halfSize = Math.floor(bufferSize / 2);

    // Compute RMS to check if there's a signal
    let rms = 0;
    for (let i = 0; i < bufferSize; i++) {
      rms += frequencyData[i] * frequencyData[i];
    }
    rms = Math.sqrt(rms / bufferSize);
    if (rms < 0.01) return 0; // Too quiet

    // Autocorrelation
    let bestOffset = -1;
    let bestCorrelation = 0;

    // Search in the range of 60Hz to 500Hz (human voice)
    const minOffset = Math.floor(sampleRate / 500);
    const maxOffset = Math.floor(sampleRate / 60);

    for (let offset = minOffset; offset < Math.min(maxOffset, halfSize); offset++) {
      let correlation = 0;
      for (let i = 0; i < halfSize; i++) {
        correlation += frequencyData[i] * (frequencyData[i + offset] ?? 0);
      }
      correlation /= halfSize;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    if (bestOffset === -1 || bestCorrelation < 0.01) return 0;
    return sampleRate / bestOffset;
  }

  analyze(): ProsodyResult {
    const values = this.volumeWindow.getAll();
    if (values.length < 5) {
      return { volumeVariance: 0, avgVolume: 0, energyScore: 0.5, pitchEstimate: 0, pitchVariance: 0, speechRate: 0 };
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;

    // Normalized energy score using dB-like scale
    const dbEnergy = avg > 0 ? Math.max(0, 1 + Math.log10(avg + 0.001) / 3) : 0;
    const expressiveness = Math.min(1, Math.sqrt(variance) * 5);
    const energyScore = Math.min(1, Math.max(0, dbEnergy * 0.5 + expressiveness * 0.5));

    // Pitch stats
    const pitchValues = this.pitchWindow.getAll();
    let pitchEstimate = 0;
    let pitchVariance = 0;
    if (pitchValues.length >= 3) {
      pitchEstimate = pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length;
      pitchVariance = pitchValues.reduce((sum, v) => sum + (v - pitchEstimate) ** 2, 0) / pitchValues.length;
    }

    // Speech rate: percentage of frames that were speaking
    const speechRate = this.speechFrameWindow.ratio(v => v);

    return { volumeVariance: variance, avgVolume: avg, energyScore, pitchEstimate, pitchVariance, speechRate };
  }

  reset() {
    this.volumeWindow.clear();
    this.pitchWindow.clear();
    this.speechFrameWindow.clear();
  }
}
