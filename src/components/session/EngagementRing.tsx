'use client';

import { ReactNode } from 'react';

interface EngagementRingProps {
  engagementScore: number;
  size?: 'full' | 'pip';
  children?: ReactNode;
}

export function EngagementRing({ engagementScore, size = 'full', children }: EngagementRingProps) {
  // Subtle thin colored line indicator — smooth color transitions
  const getColor = (score: number) => {
    if (score > 70) return 'rgba(34, 197, 94, 0.9)';      // Green: high engagement
    if (score >= 40) return 'rgba(234, 179, 8, 0.85)';     // Yellow: medium engagement
    return 'rgba(239, 68, 68, 0.9)';                       // Red: low engagement
  };

  const color = getColor(engagementScore);

  return (
    <div className="relative w-full h-full">
      {children}
      {/* Subtle top-edge engagement indicator line */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none transition-all duration-700 ease-out"
        style={{
          height: '3px',
          background: `linear-gradient(90deg, transparent 0%, ${color} 15%, ${color} 85%, transparent 100%)`,
          boxShadow: `0 0 12px ${color}, inset 0 0 4px ${color}`,
          opacity: 0.85,
        }}
      />
    </div>
  );
}
