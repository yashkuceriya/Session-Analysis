'use client';

import React, { useState } from 'react';

interface ConnectionQualityProps {
  quality: 'excellent' | 'good' | 'poor' | 'reconnecting';
  rtt?: number;
}

export function ConnectionQuality({ quality, rtt }: ConnectionQualityProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return 'text-green-500';
      case 'good':
        return 'text-yellow-500';
      case 'poor':
        return 'text-red-500';
      case 'reconnecting':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getQualityLabel = () => {
    switch (quality) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'poor':
        return 'Poor';
      case 'reconnecting':
        return 'Reconnecting';
      default:
        return 'Unknown';
    }
  };

  const getBarCount = () => {
    switch (quality) {
      case 'excellent':
        return 3;
      case 'good':
        return 2;
      case 'poor':
        return 1;
      case 'reconnecting':
        return -1; // Special case for spinner
      default:
        return 0;
    }
  };

  const tooltipText = rtt ? `Connection: ${getQualityLabel()} (RTT: ${rtt}ms)` : `Connection: ${getQualityLabel()}`;

  return (
    <div className="absolute top-3 right-10 z-20">
      <div
        className="relative cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Signal bars indicator */}
        <div className={`w-4 h-4 flex items-center justify-center ${getQualityColor()}`}>
          {quality === 'reconnecting' ? (
            // Spinning indicator for reconnecting
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          ) : (
            // Signal bars
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              {/* Bar 1 (bottom) */}
              <rect
                x="2"
                y="17"
                width="3"
                height="5"
                fill={getBarCount() >= 1 ? 'currentColor' : 'none'}
                stroke="currentColor"
              />
              {/* Bar 2 (middle) */}
              <rect
                x="7"
                y="13"
                width="3"
                height="9"
                fill={getBarCount() >= 2 ? 'currentColor' : 'none'}
                stroke="currentColor"
              />
              {/* Bar 3 (top) */}
              <rect
                x="12"
                y="9"
                width="3"
                height="13"
                fill={getBarCount() >= 3 ? 'currentColor' : 'none'}
                stroke="currentColor"
              />
            </svg>
          )}
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap border border-gray-700 shadow-lg">
            {tooltipText}
            {/* Tooltip arrow */}
            <div className="absolute top-full right-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    </div>
  );
}
