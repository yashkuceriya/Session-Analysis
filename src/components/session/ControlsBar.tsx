'use client';

import { useSessionStore } from '@/stores/sessionStore';
import { SessionTimer } from './SessionTimer';
import { LatencyIndicator } from './LatencyIndicator';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useRef, useEffect } from 'react';

interface ControlsBarProps {
  onEndSession: () => void;
  onToggleSettings: () => void;
  onStartScreenShare?: () => void;
  onStopScreenShare?: () => void;
  isScreenSharing?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  visible?: boolean;
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

  const isControlsVisible = visible && autoHideVisible;

  return (
    <div className="fixed bottom-0 left-0 right-0 flex flex-col items-center pointer-events-none z-40">
      {/* Session Timer - above controls */}
      <div className={`mb-6 transition-all duration-300 ${isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <SessionTimer />
      </div>

      {/* Main controls bar */}
      <div
        ref={controlsRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`flex items-center gap-2 px-6 h-14 rounded-full bg-gray-900/90 backdrop-blur-lg shadow-2xl border border-gray-800 transition-all duration-300 pointer-events-auto mb-6 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Group 1: Mic & Camera */}
        <button
          onClick={toggleMic}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-gray-700 relative group ${
            isMicEnabled ? 'bg-gray-700' : 'bg-red-600'
          }`}
          title={isMicEnabled ? 'Mute mic (M)' : 'Unmute mic (M)'}
        >
          {isMicEnabled ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isMicEnabled ? 'Mute' : 'Unmute'} (M)
          </span>
        </button>

        <button
          onClick={toggleCamera}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-gray-700 relative group ${
            isCameraEnabled ? 'bg-gray-700' : 'bg-red-600'
          }`}
          title={isCameraEnabled ? 'Stop video (V)' : 'Start video (V)'}
        >
          {isCameraEnabled ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isCameraEnabled ? 'Stop Video' : 'Start Video'} (V)
          </span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Group 2: Screen Share & Chat */}
        <button
          onClick={() => isScreenSharing ? onStopScreenShare?.() : onStartScreenShare?.()}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative group ${
            isScreenSharing ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20m0 0l-.75 3M9 20H5a1 1 0 01-1-1v-1a6 6 0 0112 0v1a1 1 0 01-1 1h-4m0 0l.75 3m6-18l.75 3m0 0l.75-3M21 5a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1h18z" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          </span>
        </button>

        <button
          onClick={toggleChat}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors relative group"
          title="Chat"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Chat
          </span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Group 3: View Mode, HUD & Recording */}
        <button
          onClick={() => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery')}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors relative group"
          title={viewMode === 'gallery' ? 'Speaker view (G)' : 'Gallery view (G)'}
        >
          {viewMode === 'gallery' ? (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M12 6v12M4 12h16" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {viewMode === 'gallery' ? 'Speaker View' : 'Gallery View'} (G)
          </span>
        </button>

        {/* Analysis toggle — hides all AI overlays for a clean video-call experience */}
        <button
          onClick={toggleAnalysis}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative group ${
            isAnalysisVisible ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isAnalysisVisible ? 'Hide Analysis (A)' : 'Show Analysis (A)'}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          {!isAnalysisVisible && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-0.5 bg-white/80 rounded-full transform rotate-45" />
            </div>
          )}
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isAnalysisVisible ? 'Hide Analysis' : 'Show Analysis'} (A)
          </span>
        </button>

        <button
          onClick={toggleHud}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative group ${
            isHudVisible ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isHudVisible ? 'Hide HUD (H)' : 'Show HUD (H)'}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isHudVisible ? 'Hide HUD' : 'Show HUD'} (H)
          </span>
        </button>

        <button
          onClick={() => isRecording ? onStopRecording?.() : onStartRecording?.()}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative group ${
            isRecording ? 'bg-red-600 hover:bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <svg className="w-5 h-5 text-white" fill={isRecording ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="8" strokeWidth={2} />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-700" />

        {/* Group 4: Settings & End Call */}
        <button
          onClick={onToggleSettings}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors relative group"
          title="Settings"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Settings
          </span>
        </button>

        <button
          onClick={toggleSidebar}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors relative group"
          title="Analytics"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Analytics
          </span>
        </button>

        <button
          onClick={onEndSession}
          className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors relative group"
          title="End call"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            End Call
          </span>
        </button>

        {/* Latency Badge */}
        <div className="ml-2 pl-2 border-l border-gray-700">
          <LatencyIndicator />
        </div>
      </div>
    </div>
  );
}
