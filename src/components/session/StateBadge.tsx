'use client';

import { useState } from 'react';
import { StudentState } from '@/lib/metrics-engine/types';

interface StateBadgeProps {
  state: StudentState;
  silenceDurationMs?: number;
  talkTimePercent?: number;
}

const STATE_CONFIG: Record<StudentState, { emoji: string; label: string; bgColor: string }> = {
  engaged: { emoji: '', label: '', bgColor: '' },
  passive: { emoji: '😐', label: 'Passive', bgColor: 'bg-gray-700/80' },
  confused: { emoji: '🤔', label: 'Confused', bgColor: 'bg-amber-700/80' },
  drifting: { emoji: '💤', label: 'Drifting', bgColor: 'bg-orange-700/80' },
  struggling: { emoji: '😰', label: 'Struggling', bgColor: 'bg-red-700/80' },
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
    <div className="absolute top-3 left-3 relative">
      <div
        className={`${config.bgColor} backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all duration-500 opacity-100 transform translate-y-0`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="text-lg">{config.emoji}</span>
        <span className="text-xs white font-medium text-white">{config.label}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && getTooltipContent() && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-gray-900/95 backdrop-blur-md px-3 py-2 rounded-lg text-white text-xs whitespace-nowrap shadow-lg border border-gray-700">
          {getTooltipContent()}
          <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900/95 transform rotate-45 border-t border-l border-gray-700" />
        </div>
      )}
    </div>
  );
}
