/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { AdaptiveQualityManager } from '@/lib/streaming/AdaptiveQuality';

type QualityTier = 'high' | 'medium' | 'low' | 'audio-only';

interface UseAdaptiveQualityReturn {
  quality: QualityTier;
  bandwidth: number; // kbps
  isMonitoring: boolean;
}

export function useAdaptiveQuality(
  peerConnection: RTCPeerConnection | null,
): UseAdaptiveQualityReturn {
  const [quality, setQuality] = useState<QualityTier>('medium');
  const [bandwidth, setBandwidth] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const managerRef = useRef<AdaptiveQualityManager | null>(null);

  const startMonitoring = useCallback(() => {
    if (!peerConnection) {
      return;
    }

    if (managerRef.current) {
      // Already monitoring
      return;
    }

    const manager = new AdaptiveQualityManager(peerConnection);

    manager.onQualityChange((newQuality) => {
      setQuality(newQuality);
    });

    manager.start();
    managerRef.current = manager;
    setIsMonitoring(true);

    // Poll bandwidth every 2 seconds for UI updates
    const bandwidthIntervalId = setInterval(() => {
      setBandwidth(manager.getBandwidthEstimate());
    }, 2000);

    return () => {
      clearInterval(bandwidthIntervalId);
    };
  }, [peerConnection]);

  const stopMonitoring = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.stop();
      managerRef.current.destroy();
      managerRef.current = null;
      setIsMonitoring(false);
      setQuality('medium');
      setBandwidth(0);
    }
  }, []);

  useEffect(() => {
    if (peerConnection) {
      const cleanup = startMonitoring();
      return () => {
        cleanup?.();
        stopMonitoring();
      };
    }
  }, [peerConnection, startMonitoring, stopMonitoring]);

  return {
    quality,
    bandwidth,
    isMonitoring,
  };
}
