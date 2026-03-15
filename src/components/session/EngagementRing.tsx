'use client';

import { ReactNode } from 'react';

interface EngagementRingProps {
  engagementScore: number;
  size?: 'full' | 'pip';
  children?: ReactNode;
}

export function EngagementRing({ engagementScore, size = 'full', children }: EngagementRingProps) {
  // Subtle thin colored line at the top of the video area — not a wrapping border
  const getColor = (score: number) => {
    if (score > 70) return 'rgba(34, 197, 94, 0.8)';
    if (score >= 40) return 'rgba(234, 179, 8, 0.7)';
    return 'rgba(239, 68, 68, 0.8)';
  };

  const color = getColor(engagementScore);

  return (
    <div className="relative w-full h-full">
      {children}
      {/* Subtle top-edge engagement indicator line */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none transition-all duration-1000"
        style={{
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}
