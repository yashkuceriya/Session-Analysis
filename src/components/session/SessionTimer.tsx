'use client';

import { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

export function SessionTimer() {
  const startTime = useSessionStore((s) => s.startTime);
  const isActive = useSessionStore((s) => s.isActive);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const formatted = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/[0.08] shadow-lg">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-white/90 font-mono text-sm tracking-wider font-medium">{formatted}</span>
    </div>
  );
}
