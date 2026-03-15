'use client';

import { useEffect, useState } from 'react';
import { PeerConnectionV2, ConnectionStats } from '@/lib/realtime/PeerConnectionV2';

const defaultStats: ConnectionStats = {
  rtt: 0,
  packetLoss: 0,
  bandwidth: 0,
  quality: 'good',
  audioLevel: 0,
};

export function useConnectionStats(peerConnection: PeerConnectionV2 | null): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>(defaultStats);

  useEffect(() => {
    if (!peerConnection) {
      // Use rAF to defer setState
      const raf = requestAnimationFrame(() => setStats(defaultStats));
      return () => cancelAnimationFrame(raf);
    }

    // Poll stats every 2 seconds
    let active = true;
    const poll = async () => {
      try {
        const newStats = await peerConnection.getStats();
        if (newStats && active) {
          setStats(newStats);
        }
      } catch {
        // Stats polling failed, will retry next interval
      }
    };

    const interval = setInterval(poll, 2000);
    poll(); // Initial poll

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [peerConnection]);

  return stats;
}
