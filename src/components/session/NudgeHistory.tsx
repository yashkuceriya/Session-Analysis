'use client';

import { useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

export function NudgeHistory() {
  const nudgeHistory = useSessionStore((s) => s.nudgeHistory);
  const [isOpen, setIsOpen] = useState(false);
  const startTime = useSessionStore((s) => s.startTime);

  const formatTime = (timestamp: number) => {
    if (!startTime) return '';
    const elapsed = timestamp - startTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-400 hover:text-gray-300"
      >
        <span>Nudge History ({nudgeHistory.length})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 space-y-2 max-h-48 overflow-y-auto">
          {nudgeHistory.length === 0 ? (
            <p className="text-gray-600 text-xs">No nudges yet</p>
          ) : (
            nudgeHistory.map((nudge) => (
              <div key={nudge.id} className="flex items-start gap-2 text-xs">
                <span className="text-gray-600 font-mono flex-shrink-0">
                  {formatTime(nudge.timestamp)}
                </span>
                <span>{nudge.icon}</span>
                <span className="text-gray-400">{nudge.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
