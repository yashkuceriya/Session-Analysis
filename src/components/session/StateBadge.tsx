'use client';

import { useState } from 'react';
import { StudentState } from '@/lib/metrics-engine/types';

interface StateBadgeProps {
  state: StudentState;
  silenceDurationMs?: number;
  talkTimePercent?: number;
}

const STATE_CONFIG: Record<StudentState, { emoji: string; label: string; bgColor: string; accentColor: string; dotColor: string }> = {
  engaged: { emoji: '', label: '', bgColor: '', accentColor: '', dotColor: '' },
  passive: { emoji: '😐', label: 'Passive', bgColor: 'bg-gray-800/90', accentColor: 'bg-gray-500', dotColor: 'bg-gray-400' },
  confused: { emoji: '🤔', label: 'Confused', bgColor: 'bg-yellow-950/90', accentColor: 'bg-yellow-600', dotColor: 'bg-yellow-400' },
  drifting: { emoji: '💤', label: 'Drifting', bgColor: 'bg-orange-950/90', accentColor: 'bg-orange-600', dotColor: 'bg-orange-400' },
  struggling: { emoji: '😰', label: 'Struggling', bgColor: 'bg-red-950/90', accentColor: 'bg-red-600', dotColor: 'bg-red-400' },
};

export function StateBadge({ state, silenceDurationMs, talkTimePercent }: StateBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const config = STATE_CONFIG[state];

  // Return null for engaged state
  if (state === 'engaged') {
    return null;
  }

  const getTooltipContent = () => {
    if (silenceDurationMs !== undefined && silenceDurationMs > 0) {
      const seconds = Math.floor(silenceDurationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) {
        return `Student hasn't spoken in ${minutes}m ${seconds % 60}s`;
      }
      return `Student hasn't spoken in ${seconds}s`;
    }
    if (talkTimePercent !== undefined) {
      const percent = Math.round(talkTimePercent * 100);
      return `Student talk time: ${percent}%`;
    }
    return '';
  };

  return (
    <div className="absolute top-4 left-4 relative z-15">
      <div
        className={`${config.bgColor} backdrop-blur-md border border-white/10 px-3 py-2 rounded-lg flex items-center gap-2 transition-all duration-300 hover:border-white/20 shadow-lg`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`} />

        {/* Icon */}
        <span className="text-base leading-none">{config.emoji}</span>

        {/* Label */}
        <span className="text-xs font-semibold text-white whitespace-nowrap">{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && getTooltipContent() && (
        <div className="absolute top-full mt-3 left-0 z-50 bg-gray-950/95 backdrop-blur-md px-3 py-2.5 rounded-lg text-white text-xs whitespace-nowrap shadow-xl border border-gray-700/50">
          {getTooltipContent()}
          <div className="absolute -top-1.5 left-3 w-2.5 h-2.5 bg-gray-950/95 transform rotate-45 border-t border-l border-gray-700/50" />
        </div>
      )}
    </div>
  );
}
