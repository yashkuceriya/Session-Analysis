'use client';

import { useEffect, useRef, useCallback } from 'react';
import { VoiceActivityDetector } from '@/lib/audio-processor/VoiceActivityDetector';
import { VADResult } from '@/lib/audio-processor/types';

const ANALYSIS_INTERVAL_MS = 100;

/**
 * Extracts audio from a <video> element and runs VAD on it.
 * Works with both video files (mp4 with audio track) and MediaStream-backed videos.
 */
export function useVideoElementAudio(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadRef = useRef<VoiceActivityDetector>(new VoiceActivityDetector());
  const resultRef = useRef<VADResult>({ isSpeaking: false, energy: 0, timestamp: 0 });
  const timerRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
  const connectedRef = useRef(false);

  const tryConnect = useCallback(() => {
    const video = videoRef.current;
    if (!video || !enabled || connectedRef.current) return;

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      let source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode;

      // If the video is driven by a MediaStream (live WebRTC / second camera), use that
      if (video.srcObject instanceof MediaStream) {
        const stream = video.srcObject as MediaStream;
        if (stream.getAudioTracks().length > 0) {
          source = audioContext.createMediaStreamSource(stream);
        } else {
          return; // No audio tracks in stream
        }
      } else {
        // Video element playing a file — use createMediaElementSource
        // Note: this requires CORS-compatible source or same-origin video
        source = audioContext.createMediaElementSource(video);
        // Re-connect to speakers so the video is still audible (or not — we keep it muted for demo)
        source.connect(audioContext.destination);
      }

      sourceRef.current = source;
      // Both MediaElementAudioSourceNode and MediaStreamAudioSourceNode extend AudioNode
      // VAD only needs the AudioNode interface for connect()
      vadRef.current.setup(audioContext, source as any);
      connectedRef.current = true;

      const analyze = () => {
        if (!enabled) return;
        resultRef.current = vadRef.current.detect(performance.now());
        timerRef.current = window.setTimeout(analyze, ANALYSIS_INTERVAL_MS);
      };
      analyze();
    } catch {
      // createMediaElementSource can fail if already captured or CORS
      connectedRef.current = false;
    }
  }, [videoRef, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const video = videoRef.current;
    if (!video) return;

    // Wait for video to have enough data before connecting
    const onCanPlay = () => tryConnect();

    if (video.readyState >= 2) {
      tryConnect();
    } else {
      video.addEventListener('canplay', onCanPlay, { once: true });
    }

    const vad = vadRef.current;
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
      sourceRef.current = null;
      connectedRef.current = false;
      vad.reset();
    };
  }, [enabled, tryConnect]);

  const getLatestResult = useCallback((): VADResult => {
    return resultRef.current;
  }, []);

  return { getLatestResult };
}
