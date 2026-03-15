/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import React, { useEffect, useState } from 'react';

type ConnectionStatus =
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'failed';

interface ConnectionRecoveryProps {
  status: ConnectionStatus;
  onRetry?: () => void;
  attemptCount?: number;
}

const STATUS_MESSAGES = {
  reconnecting: 'Reconnecting to call...',
  degraded: 'Poor connection — video quality reduced',
  failed: 'Connection lost',
};

export function ConnectionRecovery({
  status,
  onRetry,
  attemptCount = 0,
}: ConnectionRecoveryProps) {
  const [isVisible, setIsVisible] = useState(status !== 'connected');
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (status === 'connected') {
      setAnimationClass('animate-fadeOut');
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
      setAnimationClass('animate-fadeIn');
    }
  }, [status]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${animationClass}`}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Reconnecting State */}
        {status === 'reconnecting' && (
          <div className="text-center">
            {/* Spinner */}
            <div className="mb-4 flex justify-center">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 rounded-full border-4 border-gray-700" />
                <div
                  className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-500"
                />
              </div>
            </div>

            {/* Message */}
            <p className="text-lg font-medium text-white">
              {STATUS_MESSAGES.reconnecting}
            </p>

            {/* Attempt Count */}
            {attemptCount > 0 && (
              <p className="mt-2 text-sm text-gray-300">
                Attempt {attemptCount}
              </p>
            )}
          </div>
        )}

        {/* Degraded State */}
        {status === 'degraded' && (
          <div className="flex items-center gap-3 rounded-lg bg-yellow-500/20 px-4 py-3 backdrop-blur-sm">
            {/* Warning Icon */}
            <svg
              className="h-6 w-6 flex-shrink-0 text-yellow-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>

            <p className="font-medium text-yellow-100">
              {STATUS_MESSAGES.degraded}
            </p>
          </div>
        )}

        {/* Failed State */}
        {status === 'failed' && (
          <div className="text-center">
            {/* Error Icon */}
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-red-500/20 p-3">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>

            {/* Message */}
            <p className="mb-4 text-lg font-medium text-white">
              {STATUS_MESSAGES.failed}
            </p>

            {/* Retry Button */}
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add animation styles */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-in-out;
        }

        .animate-fadeOut {
          animation: fadeOut 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}
