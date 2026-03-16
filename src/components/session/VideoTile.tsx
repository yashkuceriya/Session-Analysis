'use client';

import { forwardRef, useCallback, useRef, useState, useEffect, memo } from 'react';
import { StudentState } from '@/lib/metrics-engine/types';

interface VideoTileProps {
  name: string;
  /** MediaStream to display — VideoTile manages its own playback internally */
  stream?: MediaStream | null;
  /** Fallback video src URL (e.g., demo video) */
  videoSrc?: string;
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

export const VideoTile = memo(forwardRef<HTMLVideoElement, VideoTileProps>(
  function VideoTile(
    {
      name,
      stream,
      videoSrc,
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
    const internalVideoRef = useRef<HTMLVideoElement | null>(null);
    const [videoActive, setVideoActive] = useState(false);

    // Merge forwarded ref with internal ref
    const setVideoRef = useCallback(
      (el: HTMLVideoElement | null) => {
        internalVideoRef.current = el;
        if (typeof forwardedRef === 'function') {
          forwardedRef(el);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
        }
      },
      [forwardedRef]
    );

    // ─── CORE FIX: Attach stream directly inside VideoTile via prop ───
    // This eliminates the fragile ref-forwarding chain for stream attachment.
    // The parent just passes `stream={localStream}` and VideoTile handles everything.
    useEffect(() => {
      const el = internalVideoRef.current;
      if (!el) return;

      if (stream) {
        // Attach MediaStream
        if (el.srcObject !== stream) {
          el.srcObject = stream;
          // Clear any old src
          el.removeAttribute('src');
        }
      } else if (videoSrc) {
        // Attach URL source (demo video)
        if (el.src !== videoSrc) {
          el.srcObject = null;
          el.src = videoSrc;
          el.loop = true;
          el.muted = true;
        }
      }

      // Always try to play — handles autoplay restrictions, re-mounts, etc.
      if ((stream || videoSrc) && el.paused) {
        el.play().catch(() => {});
      }
    }, [stream, videoSrc]);

    // Persistent play retry — some browsers (iPad Safari) need repeated play() attempts
    useEffect(() => {
      const el = internalVideoRef.current;
      if (!el) return;

      const tryPlay = () => {
        if (!el.srcObject && !el.src) return;
        if (el.paused) {
          el.play().catch(() => {});
        }
        // Mark active if stream is attached — don't wait for videoWidth
        // (some browsers report 0 until the element is visible on screen)
        if (el.srcObject && !el.paused) {
          setVideoActive(true);
        } else if (el.videoWidth > 0 && el.videoHeight > 0 && !el.paused) {
          setVideoActive(true);
        }
      };

      // Poll every 300ms until video is playing — then slow down to 2s
      const fastInterval = setInterval(tryPlay, 300);
      let slowInterval: ReturnType<typeof setInterval> | null = null;

      const onPlaying = () => {
        // Video is playing — mark active immediately
        setVideoActive(true);
        {
          // Switch to slow poll once playing
          clearInterval(fastInterval);
          if (!slowInterval) {
            slowInterval = setInterval(() => {
              // Keep checking in case video stops (e.g., track disabled)
              if (el.videoWidth > 0 && !el.paused) {
                setVideoActive(true);
              } else if (!el.srcObject && !el.src) {
                setVideoActive(false);
              }
            }, 2000);
          }
        }
      };

      el.addEventListener('playing', onPlaying);
      el.addEventListener('loadeddata', onPlaying);
      el.addEventListener('resize', onPlaying);
      el.addEventListener('emptied', () => setVideoActive(false));

      // Check immediately
      tryPlay();

      return () => {
        el.removeEventListener('playing', onPlaying);
        el.removeEventListener('loadeddata', onPlaying);
        el.removeEventListener('resize', onPlaying);
        clearInterval(fastInterval);
        if (slowInterval) clearInterval(slowInterval);
      };
    }, [stream, videoSrc]); // Re-run when stream/src changes (handles re-mounts)

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
        className={`relative overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16162a] to-[#0f0f23] transition-all duration-500 ${
          isActiveSpeaker
            ? 'ring-[1.5px] ring-blue-400/40 shadow-[0_0_40px_rgba(59,130,246,0.08)]'
            : 'ring-1 ring-white/[0.06]'
        } ${className}`}
        style={{
          borderRadius: className.includes('!rounded-none') ? 0 : '16px',
          minHeight: '200px',
        }}
      >
        {/* Video ABOVE placeholder (z-20). Always rendered, always full opacity. */}
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-20"
        />

        {/* Placeholder BEHIND video (z-10). Visible through video when no frames. */}
        <div className={`absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16162a] to-[#0f0f23] transition-opacity duration-500 ${videoActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex flex-col items-center gap-4">
              {/* Avatar circle with modern gradient and glow */}
              <div className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 ring-2 ring-white/10`}>
                {/* Subtle glow effect when speaking */}
                {isSpeaking && (
                  <div className="absolute inset-0 rounded-full animate-pulse ring-2 ring-green-400/60" />
                )}
                <span className="text-4xl sm:text-5xl font-bold text-white select-none">{getInitials()}</span>
              </div>
              {/* Name below avatar with better styling */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm sm:text-base text-white font-semibold">{name}</span>
                {/* Connection quality dot */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                    connectionQuality === 'excellent' || connectionQuality === 'good' ? 'bg-green-400' :
                    connectionQuality === 'poor' ? 'bg-yellow-400' :
                    'bg-orange-400 animate-pulse'
                  }`} />
                  <span className="text-xs text-gray-500 font-medium">
                    {connectionQuality === 'reconnecting' ? 'Connecting...' : ''}
                  </span>
                </div>
              </div>
            </div>
        </div>

        {/* Loading indicator when stream exists but video not yet active */}
        {(stream || videoSrc) && !videoActive && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-white/70 text-xs">Connecting video...</span>
            </div>
          </div>
        )}

        {/* Subtle vignette + bottom gradient for name readability */}
        <div className="absolute inset-0 z-[5] pointer-events-none" style={{
          borderRadius: '16px',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.15)',
        }} />
        <div className="absolute bottom-0 left-0 right-0 h-24 z-[5] pointer-events-none" style={{
          borderRadius: '0 0 16px 16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }} />

        {showOverlays && (
          <>
            {/* Name badge — bottom-left, minimal like Google Meet */}
            <div className="absolute bottom-3 left-4 z-30">
              <div className="flex items-center gap-2">
                <span className="text-white text-[13px] font-medium drop-shadow-lg">{name}</span>
                {isLocal && (
                  <span className="text-[10px] text-blue-300/90 font-medium">(You)</span>
                )}
                {isMuted && (
                  <div className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    </svg>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-[3px]">
                    {[5, 9, 7].map((h, i) => (
                      <div
                        key={i}
                        className="w-[3px] bg-white/80 rounded-full"
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
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
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
              <div className="absolute top-3 left-3 z-20">
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
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
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
));
