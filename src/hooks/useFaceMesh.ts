'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { FaceMeshProcessor } from '@/lib/video-processor/FaceMeshProcessor';
import { FaceFrame } from '@/lib/video-processor/types';

const DEFAULT_INTERVAL_MS = 500; // 2 Hz default
const FAST_INTERVAL_MS = 200;    // 5 Hz when attention declining
const SLOW_INTERVAL_MS = 1000;   // 1 Hz when no face detected

export function useFaceMesh(videoRef: React.RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const processorRef = useRef<FaceMeshProcessor | null>(null);
  const frameRef = useRef<FaceFrame | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const lastProcessDurationRef = useRef<number>(0);
  // Adaptive rate tracking
  const consecutiveNullFrames = useRef(0);
  const currentIntervalRef = useRef(DEFAULT_INTERVAL_MS);
  const frameCountRef = useRef(0);
  const droppedFramesRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const processor = new FaceMeshProcessor();
    processorRef.current = processor;

    processor.initialize().then(() => {
      if (!cancelled) {
        setIsModelLoaded(true);
        setModelError(null);
      }
    }).catch((err) => {
      if (!cancelled) {
        setModelError(err?.message || 'Failed to load face detection model');
        console.error('[useFaceMesh] Model initialization failed:', err);
      }
    });

    return () => {
      cancelled = true;
      processor.destroy();
      processorRef.current = null;
      setIsModelLoaded(false);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isModelLoaded) return;

    const processLoop = () => {
      const video = videoRef.current;
      const processor = processorRef.current;

      if (video && processor && processor.isReady()) {
        const start = performance.now();
        const result = processor.processFrame(video, start);
        const duration = performance.now() - start;

        frameCountRef.current++;
        lastProcessDurationRef.current = duration;

        if (result) {
          frameRef.current = result;
          consecutiveNullFrames.current = 0;

          // Adaptive: if processing is fast and we're at default, stay there
          // If we were in slow mode and got a face, go back to default
          if (currentIntervalRef.current === SLOW_INTERVAL_MS) {
            currentIntervalRef.current = DEFAULT_INTERVAL_MS;
          }
        } else {
          consecutiveNullFrames.current++;

          // After 10 consecutive missed frames, slow down to save CPU
          if (consecutiveNullFrames.current > 10) {
            currentIntervalRef.current = SLOW_INTERVAL_MS;
          }
        }

        // If processing took too long (>80% of interval), we're overloaded
        if (duration > currentIntervalRef.current * 0.8) {
          droppedFramesRef.current++;
          // Slow down if not already at slowest
          if (currentIntervalRef.current < SLOW_INTERVAL_MS) {
            currentIntervalRef.current = Math.min(currentIntervalRef.current * 1.5, SLOW_INTERVAL_MS);
          }
        }
      }

      timerRef.current = window.setTimeout(processLoop, currentIntervalRef.current);
    };

    processLoop();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, isModelLoaded, videoRef]);

  const getLatestFrame = useCallback((): FaceFrame | null => {
    return frameRef.current;
  }, []);

  const getProcessingLatency = useCallback((): number => {
    return lastProcessDurationRef.current;
  }, []);

  // Allow external trigger to speed up processing (e.g., when attention declining)
  const setFastMode = useCallback((fast: boolean) => {
    currentIntervalRef.current = fast ? FAST_INTERVAL_MS : DEFAULT_INTERVAL_MS;
  }, []);

  return { getLatestFrame, isModelLoaded, modelError, getProcessingLatency, setFastMode };
}
