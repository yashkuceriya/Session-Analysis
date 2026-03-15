'use client';

import { useState, useCallback, useEffect } from 'react';
import { MetricSnapshot } from '@/lib/metrics-engine/types';

interface UseSessionReplayReturn {
  currentIndex: number;
  currentMetric: MetricSnapshot | null;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  seek: (index: number) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  progress: number;
}

export function useSessionReplay(metricsHistory: MetricSnapshot[]): UseSessionReplayReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);

  const currentMetric = currentIndex >= 0 && currentIndex < metricsHistory.length
    ? metricsHistory[currentIndex]
    : null;

  const progress = metricsHistory.length > 0
    ? (currentIndex / (metricsHistory.length - 1)) * 100
    : 0;

  // Playback loop
  useEffect(() => {
    if (!isPlaying || metricsHistory.length === 0) return;

    // Calculate interval based on speed (500ms base interval)
    const baseInterval = 500;
    const interval = baseInterval / speed;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= metricsHistory.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, speed, metricsHistory.length]);

  const play = useCallback(() => {
    if (currentIndex >= metricsHistory.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [currentIndex, metricsHistory.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const seek = useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(index, metricsHistory.length - 1));
    setCurrentIndex(bounded);
    setIsPlaying(false);
  }, [metricsHistory.length]);

  const setSpeed = useCallback((newSpeed: number) => {
    setSpeedState(Math.max(0.25, Math.min(newSpeed, 4)));
  }, []);

  return {
    currentIndex,
    currentMetric,
    isPlaying,
    play,
    pause,
    seek,
    speed,
    setSpeed,
    progress,
  };
}
