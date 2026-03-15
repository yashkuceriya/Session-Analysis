'use client';

import React, { useState } from 'react';

type QualityTier = 'high' | 'medium' | 'low' | 'audio-only';

interface QualityIndicatorProps {
  quality: QualityTier;
  bandwidth: number; // kbps
}

const QUALITY_CONFIG: Record<
  QualityTier,
  {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
  }
> = {
  high: {
    label: '1080p',
    color: 'text-green-400',
    bgColor: 'bg-green-400/20',
    icon: '●',
  },
  medium: {
    label: '720p',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/20',
    icon: '●',
  },
  low: {
    label: '480p',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/20',
    icon: '●',
  },
  'audio-only': {
    label: 'Audio Only',
    color: 'text-red-400',
    bgColor: 'bg-red-400/20',
    icon: '◐',
  },
};

export function QualityIndicator({
  quality,
  bandwidth,
}: QualityIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = QUALITY_CONFIG[quality];

  return (
    <div className="relative">
      {/* Indicator Button */}
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${config.bgColor} cursor-help`}
      >
        {/* Status Icon */}
        <span className={`text-sm font-bold ${config.color}`}>
          {config.icon}
        </span>

        {/* Label */}
        <span className={`text-xs font-semibold ${config.color} uppercase tracking-wide`}>
          {config.label}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-100 whitespace-nowrap shadow-lg border border-gray-700">
          <div className="font-semibold">{bandwidth} kbps</div>
          <div className="text-gray-400">Estimated bandwidth</div>
          <div className="absolute top-full right-2 h-2 w-2 rotate-45 transform bg-gray-800" />
        </div>
      )}
    </div>
  );
}
