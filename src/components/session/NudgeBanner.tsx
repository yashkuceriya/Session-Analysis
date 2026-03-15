'use client';

import { useEffect, useState } from 'react';
import { Nudge } from '@/lib/coaching-system/types';

interface NudgeBannerProps {
  nudges: Nudge[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 8000;

export function NudgeBanner({ nudges, onDismiss }: NudgeBannerProps) {
  const [currentNudgeIndex, setCurrentNudgeIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Filter active (not dismissed) nudges and get the most recent
  const activeNudges = nudges.filter((n) => !n.dismissed);
  const currentNudge = activeNudges[currentNudgeIndex] || null;

  // Sort by priority (high > medium > low) then by timestamp (newest first)
  const sortedNudges = [...activeNudges].sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.timestamp - a.timestamp;
  });

  const topNudge = sortedNudges[0];

  // Update current nudge when top nudge changes
  useEffect(() => {
    const update = () => {
      if (topNudge) {
        setIsVisible(true);
        setCurrentNudgeIndex(0);
      } else {
        setIsVisible(false);
      }
    };
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [topNudge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss
  useEffect(() => {
    if (!topNudge) return;

    const timer = setTimeout(() => {
      onDismiss(topNudge.id);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [topNudge, onDismiss]);

  if (!topNudge) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-900/80 border-red-700 text-red-100';
      case 'medium':
        return 'bg-amber-900/80 border-amber-700 text-amber-50';
      case 'low':
      default:
        return 'bg-blue-900/80 border-blue-700 text-blue-50';
    }
  };

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-25 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
      }`}
    >
      <div
        className={`${getPriorityColor(topNudge.priority)} border backdrop-blur-lg rounded-lg px-4 py-3 shadow-xl max-w-lg flex items-center gap-3`}
      >
        {/* Icon */}
        <span className="text-xl flex-shrink-0">{topNudge.icon}</span>

        {/* Message */}
        <p className="flex-1 text-sm font-medium">{topNudge.message}</p>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(topNudge.id)}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Dismiss nudge"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        @keyframes slide-down {
          from {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
          to {
            transform: translateX(-50%) translateY(-20px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
