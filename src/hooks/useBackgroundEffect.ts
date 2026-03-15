/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  RefObject,
} from 'react';
import { BackgroundProcessor } from '@/lib/streaming/BackgroundProcessor';

type BackgroundMode = 'none' | 'blur' | 'image';

interface UseBackgroundEffectReturn {
  mode: BackgroundMode;
  setMode: (mode: BackgroundMode) => void;
  blurStrength: number;
  setBlurStrength: (strength: number) => void;
  processedStream: MediaStream | null;
  isProcessing: boolean;
  setBackgroundImage: (imageUrl: string) => Promise<void>;
}

export function useBackgroundEffect(
  videoRef: RefObject<HTMLVideoElement | null>,
): UseBackgroundEffectReturn {
  const [mode, setMode] = useState<BackgroundMode>('none');
  const [blurStrength, setBlurStrength] = useState(10);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processorRef = useRef<BackgroundProcessor | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Create canvas element if needed
  useEffect(() => {
    if (!canvasRef.current && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      document.body.appendChild(canvas);
      canvasRef.current = canvas;

      return () => {
        document.body.removeChild(canvas);
      };
    }
  }, []);

  const initializeProcessor = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || processorRef.current) {
      return;
    }

    try {
      const processor = new BackgroundProcessor(
        videoRef.current,
        canvasRef.current,
      );
      processorRef.current = processor;
      setProcessedStream(processor.getOutputStream());
      setIsProcessing(true);
    } catch (error) {
      console.error('Failed to initialize BackgroundProcessor:', error);
      setIsProcessing(false);
    }
  }, [videoRef]);

  const cleanupProcessor = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.destroy();
      processorRef.current = null;
      setProcessedStream(null);
      setIsProcessing(false);
    }
  }, []);

  // Handle mode changes
  useEffect(() => {
    if (mode === 'none') {
      cleanupProcessor();
    } else {
      if (!processorRef.current) {
        initializeProcessor();
      }
      processorRef.current?.setMode(mode);
      processorRef.current?.start();
    }
  }, [mode, initializeProcessor, cleanupProcessor]);

  // Handle blur strength changes
  useEffect(() => {
    if (processorRef.current && mode === 'blur') {
      processorRef.current.setBlurStrength(blurStrength);
    }
  }, [blurStrength, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupProcessor();
    };
  }, [cleanupProcessor]);

  const setBackgroundImageWrapper = useCallback(
    async (imageUrl: string): Promise<void> => {
      if (!processorRef.current) {
        initializeProcessor();
        // Give processor time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (processorRef.current) {
        await processorRef.current.setBackgroundImage(imageUrl);
      }
    },
    [initializeProcessor],
  );

  return {
    mode,
    setMode,
    blurStrength,
    setBlurStrength,
    processedStream,
    isProcessing,
    setBackgroundImage: setBackgroundImageWrapper,
  };
}
