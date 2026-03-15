'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseMediaStreamOptions {
  video?: boolean;
  audio?: boolean;
}

export function useMediaStream(options: UseMediaStreamOptions = { video: true, audio: true }) {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: options.video ? { width: 640, height: 480, facingMode: 'user' } : false,
        audio: options.audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      });
      streamRef.current = newStream;
      setStream(newStream);
      setIsReady(true);
      setError(null);
      return newStream;
    } catch (err) {
      let message = 'Failed to access camera/microphone';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          message = 'Camera/microphone access was denied. Please allow permissions and try again.';
        } else if (err.name === 'NotFoundError') {
          message = 'No camera or microphone found on this device.';
        } else if (err.name === 'NotReadableError') {
          message = 'Camera or microphone is already in use by another application.';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setIsReady(false);
      return null;
    }
  }, [options.video, options.audio]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setIsReady(false);
    }
  }, []);

  const setMicEnabled = useCallback((enabled: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, []);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { stream, isReady, error, start, stop, setMicEnabled, setCameraEnabled };
}
