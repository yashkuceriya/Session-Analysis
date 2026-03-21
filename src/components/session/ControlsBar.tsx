'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { SessionTimer } from './SessionTimer';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useRef, useState, useCallback } from 'react';

interface ControlsBarProps {
  onEndSession: () => void;
  onToggleSettings: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  isScreenSharing?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  visible?: boolean;
  isTutor?: boolean;
}

function ControlButton({
  onClick,
  active = false,
  danger = false,
  title,
  shortcut,
  children,
  className = '',
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  shortcut?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 relative group ${
        danger
          ? 'bg-red-500/90 hover:bg-red-400'
          : active
            ? 'bg-white/20 ring-1 ring-white/30'
            : 'bg-white/[0.08] hover:bg-white/[0.15]'
      } ${className}`}
      title={title}
    >
      {children}
      <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl backdrop-blur-sm font-medium">
        {title}{shortcut ? ` (${shortcut})` : ''}
      </span>
    </button>
  );
}

export function ControlsBar({
  onEndSession,
  onToggleSettings,
  onStartScreenShare,
  onStopScreenShare,
  isScreenSharing = false,
  onStartRecording,
  onStopRecording,
  visible = true,
  isTutor = true,
}: ControlsBarProps) {
  const isMicEnabled = useSessionStore((s) => s.isMicEnabled);
  const isCameraEnabled = useSessionStore((s) => s.isCameraEnabled);
  const viewMode = useSessionStore((s) => s.viewMode);
  const isRecording = useSessionStore((s) => s.isRecording);
  const isHudVisible = useSessionStore((s) => s.isHudVisible);
  const toggleMic = useSessionStore((s) => s.toggleMic);
  const toggleCamera = useSessionStore((s) => s.toggleCamera);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const toggleHud = useSessionStore((s) => s.toggleHud);
  const isAnalysisVisible = useSessionStore((s) => s.isAnalysisVisible);
  const toggleAnalysis = useSessionStore((s) => s.toggleAnalysis);
  const setRecording = useSessionStore((s) => s.setRecording);
  const toggleChat = useSessionStore((s) => s.toggleChat);
  const toggleSidebar = useSessionStore((s) => s.toggleSidebar);

  const { isVisible: autoHideVisible, onMouseEnter, onMouseLeave } = useAutoHide();
  const controlsRef = useRef<HTMLDivElement>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleEndClick = useCallback(() => {
    if (isEnding) return;
    setIsEnding(true);
    onEndSession();
  }, [isEnding, onEndSession]);

  const isControlsVisible = autoHideVisible;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center pointer-events-none z-40">
      {/* Floating pill controls — FaceTime style */}
      <div
        ref={controlsRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`relative flex items-center gap-3 px-5 py-3 rounded-full bg-black/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.5)] border border-white/[0.08] transition-all duration-500 ease-out pointer-events-auto mb-8 ${
          isControlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Mic */}
        <ControlButton
          onClick={toggleMic}
          danger={!isMicEnabled}
          title={isMicEnabled ? 'Mute' : 'Unmute'}
          shortcut="M"
        >
          {isMicEnabled ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </ControlButton>

        {/* Camera */}
        <ControlButton
          onClick={toggleCamera}
          danger={!isCameraEnabled}
          title={isCameraEnabled ? 'Stop video' : 'Start video'}
          shortcut="V"
        >
          {isCameraEnabled ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
        </ControlButton>

        {/* End call — red pill */}
        <button
          onClick={handleEndClick}
          disabled={isEnding}
          aria-label="End call"
          className={`w-14 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
            isEnding
              ? 'bg-red-700 cursor-not-allowed opacity-60'
              : 'bg-red-500 hover:bg-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 active:scale-95'
          }`}
          title="End call"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>

        {/* More menu (three dots) */}
        <div className="relative">
          <ControlButton
            onClick={() => setMenuOpen(!menuOpen)}
            active={menuOpen}
            title="More options"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </ControlButton>

          {/* Dropdown menu */}
          {menuOpen && (
            <>
              {/* Invisible backdrop to close menu */}
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full mb-3 right-0 z-50 w-56 bg-black/80 backdrop-blur-2xl rounded-2xl border border-white/[0.1] shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden py-1.5">
                {/* Timer display */}
                <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
                  <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <SessionTimer />
                </div>

                {/* View mode */}
                <MenuItem
                  icon={
                    viewMode === 'gallery' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <line x1="12" y1="3" x2="12" y2="21" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )
                  }
                  label={viewMode === 'gallery' ? 'Speaker view' : 'Gallery view'}
                  shortcut="G"
                  onClick={() => { setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery'); setMenuOpen(false); }}
                />

                {/* Screen share */}
                <MenuItem
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-3 1h12l-3-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                  label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                  active={isScreenSharing}
                  onClick={() => { isScreenSharing ? onStopScreenShare?.() : onStartScreenShare?.(); setMenuOpen(false); }}
                />

                {/* Chat */}
                <MenuItem
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                  label="Chat"
                  shortcut="C"
                  onClick={() => { toggleChat(); setMenuOpen(false); }}
                />

                {isTutor && (
                  <>
                    <div className="h-px bg-white/[0.06] my-1" />

                    {/* Analysis toggle */}
                    <MenuItem
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      }
                      label={isAnalysisVisible ? 'Hide analysis' : 'Show analysis'}
                      shortcut="A"
                      active={isAnalysisVisible}
                      onClick={() => { toggleAnalysis(); setMenuOpen(false); }}
                    />

                    {/* HUD toggle */}
                    <MenuItem
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      }
                      label={isHudVisible ? 'Hide HUD' : 'Show HUD'}
                      shortcut="H"
                      active={isHudVisible}
                      onClick={() => { toggleHud(); setMenuOpen(false); }}
                    />

                    {/* Recording */}
                    <MenuItem
                      icon={
                        <svg className="w-4 h-4" fill={isRecording ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      }
                      label={isRecording ? 'Stop recording' : 'Record'}
                      active={isRecording}
                      className={isRecording ? 'text-red-400' : ''}
                      onClick={() => { isRecording ? onStopRecording?.() : onStartRecording?.(); setMenuOpen(false); }}
                    />

                    {/* Analytics sidebar */}
                    <MenuItem
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                      }
                      label="Analytics panel"
                      onClick={() => { toggleSidebar(); setMenuOpen(false); }}
                    />
                  </>
                )}

                <div className="h-px bg-white/[0.06] my-1" />

                {/* Settings */}
                <MenuItem
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  label="Settings"
                  onClick={() => { onToggleSettings(); setMenuOpen(false); }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  shortcut,
  active,
  onClick,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-white/[0.08] ${
        active ? 'text-blue-400' : 'text-white/80'
      } ${className}`}
    >
      <span className="flex-shrink-0 opacity-70">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="text-[11px] text-white/30 font-mono">{shortcut}</span>
      )}
    </button>
  );
}
