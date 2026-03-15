import { VoiceActivityDetector } from '@/lib/audio-processor/VoiceActivityDetector';

// We can test the detect() logic without a real AudioContext by testing
// the state machine behavior via the public API

describe('VoiceActivityDetector', () => {
  it('starts in non-speaking state without setup', () => {
    const vad = new VoiceActivityDetector();
    const result = vad.detect(0);
    expect(result.isSpeaking).toBe(false);
    expect(result.energy).toBe(0);
  });

  it('resets to initial state', () => {
    const vad = new VoiceActivityDetector();
    vad.reset();
    const result = vad.detect(100);
    expect(result.isSpeaking).toBe(false);
  });
});
