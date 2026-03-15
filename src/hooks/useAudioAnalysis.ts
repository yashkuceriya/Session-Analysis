'use client';

import { useEffect, useRef, useCallback } from 'react';
import { VoiceActivityDetector } from '@/lib/audio-processor/VoiceActivityDetector';
import { VADResult } from '@/lib/audio-processor/types';

const ANALYSIS_INTERVAL_MS = 100; // 10 Hz

export function useAudioAnalysis(stream: MediaStream | null, enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadRef = useRef<VoiceActivityDetector>(new VoiceActivityDetector());
  const resultRef = useRef<VADResult>({ isSpeaking: false, energy: 0, timestamp: 0 });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !enabled) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const vad = vadRef.current;
    vad.setup(audioContext, source);

    const analyze = () => {
      resultRef.current = vad.detect(performance.now());
      timerRef.current = window.setTimeout(analyze, ANALYSIS_INTERVAL_MS);
    };

    analyze();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      audioContext.close();
      audioContextRef.current = null;
      vad.reset();
    };
  }, [stream, enabled]);

  const getLatestResult = useCallback((): VADResult => {
    return resultRef.current;
  }, []);

  return { getLatestResult };
}
