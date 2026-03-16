'use client';

import { useEffect, useState } from 'react';
import { Nudge } from '@/lib/coaching-system/types';

interface NudgeBannerProps {
  nudges: Nudge[];
  onDismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 10000;

export function NudgeBanner({ nudges, onDismiss }: NudgeBannerProps) {
  const [currentNudgeIndex, setCurrentNudgeIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);

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
        setIsDismissing(false);
        setCurrentNudgeIndex(0);
      } else {
        setIsVisible(false);
      }
    };
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [topNudge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-dismiss with progress bar
  useEffect(() => {
    if (!topNudge || isDismissing) return;

    const timer = setTimeout(() => {
      setIsDismissing(true);
      setTimeout(() => {
        onDismiss(topNudge.id);
      }, 300); // Match fade-out animation
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [topNudge, onDismiss, isDismissing]);

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onDismiss(topNudge!.id);
    }, 300);
  };

  if (!topNudge) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-950/90 border-red-700 text-red-100 shadow-red-500/20';
      case 'medium':
        return 'bg-amber-950/90 border-amber-700 text-amber-50 shadow-amber-500/20';
      case 'low':
      default:
        return 'bg-blue-950/90 border-blue-700 text-blue-50 shadow-blue-500/20';
    }
  };

  const getPriorityAccent = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-600';
      case 'medium':
        return 'bg-amber-600';
      case 'low':
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div
      className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ease-out ${
        isVisible && !isDismissing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div
        className={`${getPriorityColor(topNudge.priority)} border backdrop-blur-xl rounded-2xl px-5 py-3.5 shadow-2xl max-w-md flex items-center gap-3.5 relative overflow-hidden`}
      >
        {/* Left accent border */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${getPriorityAccent(topNudge.priority)}`} />

        {/* Icon */}
        <span className="text-xl flex-shrink-0">{topNudge.icon}</span>

        {/* Message */}
        <p className="flex-1 text-sm font-semibold leading-snug">{topNudge.message}</p>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 hover:opacity-50 transition-all duration-200 p-1.5 hover:bg-white/10 rounded-lg"
          aria-label="Dismiss nudge"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Auto-dismiss progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-transparent to-white/40 transition-all duration-100"
            style={{
              width: isDismissing ? '0%' : '100%',
              animation: isDismissing ? 'none' : `progress ${AUTO_DISMISS_MS}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}
