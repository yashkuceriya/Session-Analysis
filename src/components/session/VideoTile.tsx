'use client';

import { forwardRef, useCallback, useRef, useState, useEffect } from 'react';
import { StudentState } from '@/lib/metrics-engine/types';

interface VideoTileProps {
  name: string;
  isSpeaking?: boolean;
  eyeContactScore?: number;
  isMuted?: boolean;
  isLocal?: boolean;
  engagementScore?: number;
  studentState?: StudentState;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'reconnecting';
  isActiveSpeaker?: boolean;
  showOverlays?: boolean;
  className?: string;
}

export const VideoTile = forwardRef<HTMLVideoElement, VideoTileProps>(
  function VideoTile(
    {
      name,
      isSpeaking = false,
      eyeContactScore,
      isMuted = false,
      isLocal = false,
      engagementScore = 50,
      studentState,
      connectionQuality,
      isActiveSpeaker = false,
      showOverlays = true,
      className = '',
    },
    forwardedRef
  ) {
    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const [hasVideoSrc, setHasVideoSrc] = useState(false);

    // Merge forwarded ref with local ref
    const setVideoRef = useCallback(
      (el: HTMLVideoElement | null) => {
        localVideoRef.current = el;
        if (typeof forwardedRef === 'function') {
          forwardedRef(el);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        }
      },
      [forwardedRef]
    );

    // Detect when video has a real source and is playing
    useEffect(() => {
      const check = () => {
        const el = localVideoRef.current;
        if (!el) return;
        // Video is "ready" if it has a srcObject OR is actively playing
        const ready = !!(el.srcObject || (el.readyState >= 2));
        if (ready && !hasVideoSrc) setHasVideoSrc(true);
      };
      check();
      const interval = setInterval(check, 100);
      return () => clearInterval(interval);
    }, []);

    // Engagement color — used for a subtle bottom accent line
    const getEngagementColor = () => {
      if (engagementScore > 70) return 'rgba(34, 197, 94, 0.6)';
      if (engagementScore >= 40) return 'rgba(234, 179, 8, 0.5)';
      return 'rgba(239, 68, 68, 0.5)';
    };

    // Eye contact indicator
    const getEyeContactColor = () => {
      if (eyeContactScore === undefined) return 'bg-gray-500/60';
      if (eyeContactScore > 0.6) return 'bg-green-500/80';
      if (eyeContactScore > 0.3) return 'bg-amber-500/80';
      return 'bg-red-500/80';
    };

    // Initials fallback
    const getInitials = () => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    // Gradient for placeholder avatar
    const avatarGradients = [
      'from-blue-600 to-indigo-700',
      'from-emerald-600 to-teal-700',
      'from-violet-600 to-purple-700',
      'from-rose-600 to-pink-700',
      'from-amber-600 to-orange-700',
    ];
    const gradientIndex = name.length % avatarGradients.length;
    const avatarGradient = avatarGradients[gradientIndex];

    return (
      <div
        className={`relative overflow-hidden bg-gray-900 transition-all duration-300 ${
          isActiveSpeaker ? 'ring-2 ring-blue-500/50' : ''
        } ${className}`}
        style={{ borderRadius: className.includes('!rounded-none') ? 0 : '12px' }}
      >
        {/* Video element — always rendered, placeholder overlays when no source */}
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isLocal || isMuted}
          onLoadedData={() => setHasVideoSrc(true)}
          onPlaying={() => setHasVideoSrc(true)}
          className="w-full h-full object-cover"
        />

        {/* No-camera placeholder — polished avatar */}
        {!hasVideoSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800">
            <div className="flex flex-col items-center gap-3">
              {/* Avatar circle with gradient */}
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-lg`}>
                <span className="text-3xl sm:text-4xl font-semibold text-white/90 select-none">{getInitials()}</span>
              </div>
              {/* Name below avatar */}
              <span className="text-sm text-gray-400 font-medium">{name}</span>
            </div>
          </div>
        )}

        {showOverlays && (
          <>
            {/* Bottom bar: name + muted + speaking indicator */}
            <div className="absolute bottom-0 left-0 right-0 z-10">
              {/* Subtle engagement accent line */}
              <div
                className="h-[2px] w-full transition-colors duration-1000"
                style={{ backgroundColor: getEngagementColor() }}
              />
              <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                {/* Left: name + role */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white text-sm font-medium truncate">{name}</span>
                  {isLocal && (
                    <span className="text-[10px] text-gray-400 bg-gray-700/60 px-1.5 py-0.5 rounded">You</span>
                  )}
                  {isMuted && (
                    <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.49-.34 2.18" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                </div>

                {/* Right: speaking bars */}
                {isSpeaking && (
                  <div className="flex items-center gap-0.5">
                    {[8, 12, 10].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-green-400 rounded-full"
                        style={{
                          height: `${h}px`,
                          animation: `tile-bounce 0.6s ease-in-out infinite`,
                          animationDelay: `${i * 100}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top-right: eye contact dot + connection quality (compact) */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              {eyeContactScore !== undefined && (
                <div className={`w-2.5 h-2.5 rounded-full ${getEyeContactColor()} transition-colors duration-500`} />
              )}
              {connectionQuality && (connectionQuality === 'poor' || connectionQuality === 'reconnecting') && (
                <div className={`text-xs px-1.5 py-0.5 rounded bg-black/50 ${
                  connectionQuality === 'poor' ? 'text-yellow-400' : 'text-orange-400'
                }`}>
                  {connectionQuality === 'reconnecting' ? '...' : '!'}
                </div>
              )}
            </div>

            {/* Top-left: student state badge (only when not engaged) */}
            {studentState && studentState !== 'engaged' && (
              <div className="absolute top-3 left-3 z-10">
                {(() => {
                  const stateConfig: Record<StudentState, { emoji: string; label: string; bg: string }> = {
                    engaged: { emoji: '', label: '', bg: '' },
                    passive: { emoji: '😐', label: 'Passive', bg: 'bg-gray-700/70' },
                    confused: { emoji: '🤔', label: 'Confused', bg: 'bg-amber-700/70' },
                    drifting: { emoji: '💤', label: 'Drifting', bg: 'bg-orange-700/70' },
                    struggling: { emoji: '😰', label: 'Struggling', bg: 'bg-red-700/70' },
                  };
                  const config = stateConfig[studentState];
                  return (
                    <div className={`${config.bg} backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-1 text-xs`}>
                      <span>{config.emoji}</span>
                      <span className="text-white font-medium">{config.label}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Active speaker label — small top-center pill */}
            {isActiveSpeaker && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-blue-500/70 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Speaking</span>
                </div>
              </div>
            )}
          </>
        )}

        <style jsx>{`
          @keyframes tile-bounce {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(1.5); }
          }
        `}</style>
      </div>
    );
  }
);
