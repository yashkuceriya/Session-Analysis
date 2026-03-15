'use client';

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Layout & Video
import { VideoLayout } from '@/components/session/VideoLayout';
import { FloatingSelfView } from '@/components/session/FloatingSelfView';
import { ControlsBar } from '@/components/session/ControlsBar';
import { SessionSkeleton } from '@/components/session/SessionSkeleton';
// Analysis Overlays
import { EngagementRing } from '@/components/session/EngagementRing';
import { StateBadge } from '@/components/session/StateBadge';
import { NudgeBanner } from '@/components/session/NudgeBanner';
import { MetricsHUD } from '@/components/session/MetricsHUD';
import { TimelineStrip } from '@/components/session/TimelineStrip';
// Session panels
import { MetricsSidebar } from '@/components/session/MetricsSidebar';
import { NudgeHistory } from '@/components/session/NudgeHistory';
import { NudgeSettingsPanel } from '@/components/settings/NudgeSettingsPanel';
import { ChatPanel } from '@/components/session/ChatPanel';
// Recording & Screen Share
import { RecordingIndicator } from '@/components/session/RecordingIndicator';
import { ScreenShareBanner } from '@/components/session/ScreenShareBanner';
import { ReactionOverlay } from '@/components/session/ReactionOverlay';
// Error handling
import { SessionErrorBoundary } from '@/components/session/SessionErrorBoundary';
// Accessibility
import { LiveCaptions } from '@/components/accessibility/LiveCaptions';
import { KeyboardShortcutsHelp } from '@/components/accessibility/KeyboardShortcutsHelp';
import { useAccessibilityStore } from '@/stores/accessibilityStore';
// Hooks
import { useMediaStream } from '@/hooks/useMediaStream';
import { useFaceMesh } from '@/hooks/useFaceMesh';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useVideoElementAudio } from '@/hooks/useVideoElementAudio';
import { useMetricsEngine } from '@/hooks/useMetricsEngine';
import { useScreenShare } from '@/hooks/useScreenShare';
import { useRecording } from '@/hooks/useRecording';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useAutoHide } from '@/hooks/useAutoHide';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAdaptiveQuality } from '@/hooks/useAdaptiveQuality';
// State & Services
import { useSessionStore } from '@/stores/sessionStore';
import { saveSession, StoredSession } from '@/lib/persistence/SessionStorage';
import { PeerConnectionV2, ConnectionState } from '@/lib/realtime/PeerConnectionV2';

export default function SessionPage() {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionErrorBoundary>
        <SessionPageInner />
      </SessionErrorBoundary>
    </Suspense>
  );
}

function SessionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const selfViewRef = useRef<HTMLVideoElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const saveIntervalRef = useRef<number | null>(null);
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string; timestamp: number }>>([]);

  // Parse URL params
  const roomId = searchParams.get('room');
  const role = (searchParams.get('role') as 'tutor' | 'student') || 'tutor';
  const roomToken = searchParams.get('token');
  const isRoomMode = !!roomId;

  // Peer connection state
  const peerRef = useRef<PeerConnectionV2 | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'reconnecting'>('good');
  const [rtcPeerConnection, setRtcPeerConnection] = useState<RTCPeerConnection | null>(null);

  // Store
  const isActive = useSessionStore((s) => s.isActive);
  const sessionId = useSessionStore((s) => s.sessionId);
  const sessionConfig = useSessionStore((s) => s.sessionConfig);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const isSidebarOpen = useSessionStore((s) => s.isSidebarOpen);
  const isMicEnabled = useSessionStore((s) => s.isMicEnabled);
  const isCameraEnabled = useSessionStore((s) => s.isCameraEnabled);
  const viewMode = useSessionStore((s) => s.viewMode);
  const isHudVisible = useSessionStore((s) => s.isHudVisible);
  const isChatOpen = useSessionStore((s) => s.isChatOpen);
  const toggleChat = useSessionStore((s) => s.toggleChat);
  const currentMetrics = useSessionStore((s) => s.currentMetrics);
  const metricsHistory = useSessionStore((s) => s.metricsHistory);
  const metricsArchive = useSessionStore((s) => s.metricsArchive);
  const activeNudges = useSessionStore((s) => s.activeNudges);
  const nudgeHistory = useSessionStore((s) => s.nudgeHistory);
  const dismissNudge = useSessionStore((s) => s.dismissNudge);
  const setViewMode = useSessionStore((s) => s.setViewMode);
  const toggleMic = useSessionStore((s) => s.toggleMic);
  const toggleHud = useSessionStore((s) => s.toggleHud);
  const isAnalysisVisible = useSessionStore((s) => s.isAnalysisVisible);
  const toggleAnalysis = useSessionStore((s) => s.toggleAnalysis);

  // Accessibility
  const captionsEnabled = useAccessibilityStore((s) => s.captionsEnabled);

  // Adaptive quality monitoring
  const { quality: streamQuality } = useAdaptiveQuality(rtcPeerConnection);

  // Local webcam + mic
  const {
    stream: localStream,
    isReady: streamReady,
    error: streamError,
    start: startStream,
    setMicEnabled,
    setCameraEnabled,
  } = useMediaStream();

  // Screen sharing
  const { isSharing, screenStream, startSharing, stopSharing } = useScreenShare();

  // Recording
  const {
    isRecording: recIsRecording,
    duration: recDuration,
    isPaused: recIsPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
  } = useRecording();

  // Chat (basic local state — DataChannel integration when PeerConnectionV2 is used)
  const { messages: chatMessages, sendMessage: chatSendMessage, unreadCount, markAsRead } = useChatChannel();

  // Auto-hide controls
  const { isVisible: controlsVisible, onMouseMove } = useAutoHide();

  // Toggle hardware tracks
  useEffect(() => { setMicEnabled(isMicEnabled); }, [isMicEnabled, setMicEnabled]);
  useEffect(() => { setCameraEnabled(isCameraEnabled); }, [isCameraEnabled, setCameraEnabled]);

  // Sync adaptive quality to connection quality display (when in room mode)
  useEffect(() => {
    if (!isRoomMode) return;
    const update = () => {
      if (streamQuality === 'high') setConnectionQuality('excellent');
      else if (streamQuality === 'medium') setConnectionQuality('good');
      else setConnectionQuality('poor');
    };
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [streamQuality, isRoomMode]);

  // Face mesh on BOTH video elements (local + remote/demo)
  const localFaceMesh = useFaceMesh(localVideoRef, isActive && streamReady);
  const remoteFaceMesh = useFaceMesh(remoteVideoRef, isActive);

  // Audio analysis on local mic
  const localAudio = useAudioAnalysis(localStream, isActive && streamReady);

  // Audio analysis on remote stream or demo video
  const remoteAudio = useAudioAnalysis(remoteStream, isActive && !!remoteStream);
  const remoteVideoAudio = useVideoElementAudio(remoteVideoRef, isActive && !remoteStream);

  // Determine which face is tutor and which is student based on role
  const getTutorFace = useCallback(() => {
    if (!isRoomMode || role === 'tutor') return localFaceMesh.getLatestFrame();
    return remoteFaceMesh.getLatestFrame();
  }, [isRoomMode, role, localFaceMesh, remoteFaceMesh]);

  const getStudentFace = useCallback(() => {
    if (!isRoomMode || role === 'student') return remoteFaceMesh.getLatestFrame();
    return localFaceMesh.getLatestFrame();
  }, [isRoomMode, role, localFaceMesh, remoteFaceMesh]);

  const getTutorAudio = useCallback(() => {
    if (!isRoomMode || role === 'tutor') return localAudio.getLatestResult();
    if (remoteStream) return remoteAudio.getLatestResult();
    return remoteVideoAudio.getLatestResult();
  }, [isRoomMode, role, localAudio, remoteAudio, remoteVideoAudio, remoteStream]);

  const getStudentAudio = useCallback(() => {
    if (isRoomMode && role === 'tutor') {
      if (remoteStream) return remoteAudio.getLatestResult();
      return remoteVideoAudio.getLatestResult();
    }
    if (isRoomMode && role === 'student') return localAudio.getLatestResult();
    return remoteVideoAudio.getLatestResult();
  }, [isRoomMode, role, localAudio, remoteAudio, remoteVideoAudio, remoteStream]);

  // Metrics engine — real analysis on all inputs
  useMetricsEngine({
    getTutorFace,
    getStudentFace,
    getTutorAudio,
    getStudentAudio,
    getTutorFaceLatency: () => {
      if (!isRoomMode || role === 'tutor') return localFaceMesh.getProcessingLatency();
      return remoteFaceMesh.getProcessingLatency();
    },
    getStudentFaceLatency: () => {
      if (!isRoomMode || role === 'student') return remoteFaceMesh.getProcessingLatency();
      return localFaceMesh.getProcessingLatency();
    },
    sessionType: sessionConfig.sessionType,
    enabled: isActive,
  });

  // Keyboard shortcuts
  const shortcutMap = useMemo(() => ({
    m: () => toggleMic(),
    v: () => useSessionStore.getState().toggleCamera(),
    g: () => setViewMode(viewMode === 'gallery' ? 'speaker' : 'gallery'),
    h: () => toggleHud(),
    a: () => toggleAnalysis(),
    c: () => toggleChat(),
    '?': () => setShowShortcutsHelp(prev => !prev),
    Escape: () => {
      setShowSettings(false);
      if (isChatOpen) toggleChat();
    },
  }), [viewMode, toggleMic, setViewMode, toggleHud, toggleAnalysis, toggleChat, isChatOpen]);

  useKeyboardShortcuts(shortcutMap, { enabled: isActive });

  // Determine active speaker for speaker view
  const activeSpeaker: 'tutor' | 'student' = useMemo(() => {
    if (!currentMetrics) return 'tutor';
    if (currentMetrics.student.isSpeaking) return 'student';
    if (currentMetrics.tutor.isSpeaking) return 'tutor';
    // Default to whoever has higher engagement
    return currentMetrics.student.eyeContactScore > currentMetrics.tutor.eyeContactScore ? 'student' : 'tutor';
  }, [currentMetrics]);

  // Keep self-view video ref in sync with local stream
  useEffect(() => {
    if (selfViewRef.current && localStream) {
      selfViewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Start local media + session on mount
  useEffect(() => {
    const init = async () => {
      await startStream();
      if (!isActive) {
        startSession(sessionConfig);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local video element in sync with stream (handles ref timing issues)
  useEffect(() => {
    if (!localStream) return;
    const attachStream = () => {
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    };
    // Try immediately + retry on interval until attached
    attachStream();
    const interval = setInterval(attachStream, 100);
    // Stop retrying once video is playing
    const onPlaying = () => clearInterval(interval);
    localVideoRef.current?.addEventListener('playing', onPlaying);
    return () => {
      clearInterval(interval);
      localVideoRef.current?.removeEventListener('playing', onPlaying);
    };
  }, [localStream]);

  // Verify room token if provided
  useEffect(() => {
    if (isRoomMode && roomToken) {
      fetch('/api/rooms/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: roomToken, roomId }),
      }).then(res => {
        if (!res.ok) {
          console.warn('Room token verification failed — proceeding anyway for backward compatibility');
        }
      }).catch(() => {
        // Token verification unavailable, proceed
      });
    }
  }, [isRoomMode, roomToken, roomId]);

  // WebRTC: start peer connection when in room mode and local stream is ready
  useEffect(() => {
    if (!isRoomMode || !localStream || !streamReady) return;

    const peer = new PeerConnectionV2({
      roomId: roomId!,
      role: role as 'tutor' | 'student',
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onPeerState: (state: ConnectionState) => {
        setPeerConnected(state === 'connected');
        if (state === 'reconnecting') setConnectionQuality('reconnecting');
        else if (state === 'connected') setConnectionQuality('good');
      },
      onDataMessage: (msg) => {
        // Handle incoming data channel messages (chat, reactions)
        if (msg.type === 'chat' && typeof msg.data === 'object' && msg.data !== null) {
          // Could dispatch to chat — for now just log
        }
        if (msg.type === 'reaction' && typeof msg.data === 'string') {
          setReactions(prev => [...prev, { id: `${Date.now()}`, emoji: msg.data as string, timestamp: Date.now() }]);
        }
      },
    });
    peerRef.current = peer;
    peer.start(localStream);
    peer.ensureDataChannel(); // Create DataChannel for chat/reactions
    setRtcPeerConnection(peer.getPeerConnection());

    return () => {
      peer.stop();
      peerRef.current = null;
      setRemoteStream(null);
      setPeerConnected(false);
      setRtcPeerConnection(null);
    };
  }, [isRoomMode, roomId, role, localStream, streamReady]);

  // Solo/demo mode: load student demo video
  useEffect(() => {
    if (isRoomMode) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    video.src = '/demo/student-sample.mp4';
    video.loop = true;
    video.muted = true;
    video.play().catch(() => {
      // No demo video — animated placeholder
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      let rafId: number;

      const draw = () => {
        const t = Date.now() / 1000;
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, 640, 480);
        const bobY = Math.sin(t * 0.8) * 5;
        ctx.beginPath();
        ctx.arc(320, 200 + bobY, 60, 0, Math.PI * 2);
        ctx.fillStyle = '#4a5568';
        ctx.fill();
        const blink = Math.sin(t * 3) > 0.95;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(298, 192 + bobY, 12, blink ? 1 : 6);
        ctx.fillRect(330, 192 + bobY, 12, blink ? 1 : 6);
        ctx.beginPath();
        ctx.arc(320, 218 + bobY, 8, 0, Math.PI);
        ctx.fillStyle = '#2d3748';
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Student (Placeholder)', 320, 380);
        rafId = requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = canvas.captureStream(15);
      video.srcObject = canvasStream;
      video.play().catch(() => {});

      return () => cancelAnimationFrame(rafId);
    });
  }, [isRoomMode]);

  // Auto-save to IndexedDB + Supabase
  const lastSyncedIndexRef = useRef(0);
  useEffect(() => {
    if (!isActive || !sessionId) return;

    // Create session in Supabase on start
    const state = useSessionStore.getState();
    fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sessionId, config: state.sessionConfig, startTime: state.startTime }),
    }).catch(() => {});

    const persistSession = () => {
      const s = useSessionStore.getState();
      // IndexedDB (local backup)
      const stored: StoredSession = {
        id: s.sessionId!,
        config: s.sessionConfig,
        startTime: s.startTime!,
        endTime: null,
        status: 'active',
        metricsHistory: [...s.metricsArchive, ...s.metricsHistory],
        nudgeHistory: s.nudgeHistory,
      };
      saveSession(stored).catch(() => {});

      // Supabase (server-side, only send new snapshots)
      const allMetrics = [...s.metricsArchive, ...s.metricsHistory];
      const newSnapshots = allMetrics.slice(lastSyncedIndexRef.current);
      if (newSnapshots.length > 0) {
        fetch(`/api/sessions/${s.sessionId}/metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshots: newSnapshots, nudges: s.nudgeHistory }),
        }).then(() => {
          lastSyncedIndexRef.current = allMetrics.length;
        }).catch(() => {});
      }
    };
    saveIntervalRef.current = window.setInterval(persistSession, 5000);
    return () => {
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
    };
  }, [isActive, sessionId]);

  // Screen share handlers
  const handleStartScreenShare = useCallback(async () => {
    const stream = await startSharing();
    if (stream && localVideoRef.current) {
      // Replace camera with screen share in the main view
      localVideoRef.current.srcObject = stream;
    }
  }, [startSharing]);

  const handleStopScreenShare = useCallback(() => {
    stopSharing();
    // Restore camera
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [stopSharing, localStream]);

  // Recording handlers
  const handleStartRecording = useCallback(() => {
    const streams: MediaStream[] = [];
    if (localStream) streams.push(localStream);
    if (remoteStream) streams.push(remoteStream);
    if (streams.length > 0) startRecording(streams);
  }, [localStream, remoteStream, startRecording]);

  const handleStopRecording = useCallback(async () => {
    const blob = await stopRecording();
    if (blob) downloadRecording(blob);
  }, [stopRecording, downloadRecording]);

  const handleEndSession = () => {
    const state = useSessionStore.getState();
    const sid = state.sessionId;

    // Navigate IMMEDIATELY — don't wait for saves
    endSession();
    peerRef.current?.stop();
    router.push(`/analytics/${sid}`);

    // Fire-and-forget: save in background
    if (sid) {
      const allMetrics = [...state.metricsArchive, ...state.metricsHistory];
      saveSession({
        id: sid,
        config: state.sessionConfig,
        startTime: state.startTime!,
        endTime: Date.now(),
        status: 'completed',
        metricsHistory: allMetrics,
        nudgeHistory: state.nudgeHistory,
      }).catch(() => {});
      const unsyncedSnapshots = allMetrics.slice(lastSyncedIndexRef.current);
      fetch(`/api/sessions/${sid}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshots: unsyncedSnapshots, nudges: state.nudgeHistory }),
      }).catch(() => {});
      fetch(`/api/sessions/${sid}`, { method: 'PATCH' }).catch(() => {});
    }
  };

  // Display names
  const localLabel = isRoomMode ? (role === 'tutor' ? 'You (Tutor)' : 'You (Student)') : sessionConfig.tutorName;
  const remoteLabel = isRoomMode
    ? (role === 'tutor' ? sessionConfig.studentName : sessionConfig.tutorName)
    : sessionConfig.studentName;

  // Combined metrics history for timeline
  const fullHistory = useMemo(() => [...metricsArchive, ...metricsHistory], [metricsArchive, metricsHistory]);

  if (!streamReady && !streamError) {
    return <SessionSkeleton />;
  }

  if (streamError) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">📷</div>
          <h2 className="text-white text-xl font-semibold mb-2">Camera Access Required</h2>
          <p className="text-gray-400 mb-4">
            Please allow camera and microphone access to start the session.
          </p>
          <p className="text-gray-600 text-sm">{streamError}</p>
          <button
            onClick={() => startStream()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden" onMouseMove={onMouseMove}>
      {/* Screen share banner */}
      <ScreenShareBanner isSharing={isSharing} onStopSharing={handleStopScreenShare} />

      {/* Recording indicator */}
      <RecordingIndicator
        isRecording={recIsRecording}
        duration={recDuration}
        isPaused={recIsPaused}
        onStop={handleStopRecording}
        onPause={pauseRecording}
        onResume={resumeRecording}
      />

      {/* Room mode status badge with invite link */}
      {isRoomMode && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-gray-900/70 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs">
          <span className="text-gray-400">
            Room: <span className="text-white font-mono">{roomId}</span>
          </span>
          <button
            onClick={() => {
              const joinUrl = `${window.location.origin}/join/${roomId}`;
              navigator.clipboard.writeText(joinUrl).then(() => {
                alert('Join link copied! Share with your student.');
              });
            }}
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Copy invite link
          </button>
          <div className={`w-2 h-2 rounded-full ${
            peerConnected ? (connectionQuality === 'excellent' || connectionQuality === 'good' ? 'bg-green-500' : connectionQuality === 'poor' ? 'bg-yellow-500' : 'bg-orange-500 animate-pulse')
            : 'bg-yellow-500 animate-pulse'
          }`} />
          <span className={
            peerConnected ? (connectionQuality === 'poor' ? 'text-yellow-400' : connectionQuality === 'reconnecting' ? 'text-orange-400' : 'text-green-400')
            : 'text-yellow-400'
          }>
            {peerConnected ? (connectionQuality === 'reconnecting' ? 'Reconnecting...' : 'Connected') : 'Waiting...'}
          </span>
        </div>
      )}

      {/* Main content: video-first layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video area — flex-1 + min-h-0 ensures tiles fill height */}
        <div className="flex-1 relative min-h-0 min-w-0">
          {/* Video layout — optionally wrapped with engagement ring */}
          {isAnalysisVisible ? (
            <EngagementRing engagementScore={currentMetrics?.engagementScore ?? 50}>
              <VideoLayout
                tutorVideoRef={viewMode === 'speaker' && activeSpeaker === 'student' ? remoteVideoRef : localVideoRef}
                studentVideoRef={viewMode === 'speaker' && activeSpeaker === 'student' ? localVideoRef : remoteVideoRef}
                localVideoRef={localVideoRef}
                tutorLabel={viewMode === 'speaker' && activeSpeaker === 'student' ? remoteLabel : localLabel}
                studentLabel={viewMode === 'speaker' && activeSpeaker === 'student' ? localLabel : remoteLabel}
                viewMode={viewMode}
                activeSpeaker={activeSpeaker}
                showOverlays={true}
              />
            </EngagementRing>
          ) : (
            <VideoLayout
              tutorVideoRef={viewMode === 'speaker' && activeSpeaker === 'student' ? remoteVideoRef : localVideoRef}
              studentVideoRef={viewMode === 'speaker' && activeSpeaker === 'student' ? localVideoRef : remoteVideoRef}
              localVideoRef={localVideoRef}
              tutorLabel={viewMode === 'speaker' && activeSpeaker === 'student' ? remoteLabel : localLabel}
              studentLabel={viewMode === 'speaker' && activeSpeaker === 'student' ? localLabel : remoteLabel}
              viewMode={viewMode}
              activeSpeaker={activeSpeaker}
              showOverlays={false}
            />
          )}

          {/* Analysis overlays — hidden when analysis mode is off */}
          {isAnalysisVisible && (
            <>
              {/* Student state badge (on student video area) */}
              {currentMetrics && (
                <StateBadge
                  state={currentMetrics.studentState}
                  silenceDurationMs={currentMetrics.student.silenceDurationMs}
                  talkTimePercent={currentMetrics.student.talkTimePercent}
                />
              )}

              {/* Nudge banners — top of video area */}
              <NudgeBanner nudges={activeNudges} onDismiss={dismissNudge} />

              {/* Engagement timeline strip — bottom of video area */}
              <TimelineStrip metricsHistory={fullHistory} nudgeHistory={nudgeHistory} />
            </>
          )}

          {/* Reactions overlay */}
          <ReactionOverlay reactions={reactions} />

          {/* Face model loading indicator */}
          {isActive && !localFaceMesh.isModelLoaded && (
            <div className={`absolute top-14 left-3 z-20 ${localFaceMesh.modelError ? 'bg-red-900/80 text-red-200' : 'bg-blue-900/80 text-blue-200'} text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm`}>
              {localFaceMesh.modelError
                ? `Face detection unavailable: ${localFaceMesh.modelError}`
                : 'Loading face detection model...'}
            </div>
          )}
        </div>

        {/* Floating self-view in speaker mode */}
        {viewMode === 'speaker' && (
          <FloatingSelfView
            videoRef={localVideoRef}
            name={localLabel || 'You'}
            isMuted={!isMicEnabled}
            eyeContactScore={currentMetrics?.tutor.eyeContactScore}
          />
        )}

        {/* Sidebar (when toggled — analytics panel) */}
        {isSidebarOpen && (
          <div className="flex flex-col w-72 border-l border-gray-800 bg-gray-950 z-30">
            <MetricsSidebar />
            <NudgeHistory />
          </div>
        )}

        {/* Chat panel */}
        <ChatPanel
          isOpen={isChatOpen}
          messages={chatMessages}
          onSendMessage={chatSendMessage}
          onClose={() => { toggleChat(); markAsRead(); }}
          unreadCount={unreadCount}
        />
      </div>

      {/* Metrics HUD overlay — only when analysis mode is on */}
      <MetricsHUD visible={isHudVisible && isAnalysisVisible} />

      {/* Floating controls bar */}
      <ControlsBar
        onEndSession={handleEndSession}
        onToggleSettings={() => setShowSettings(!showSettings)}
        visible={controlsVisible}
      />

      {/* Settings modal */}
      <NudgeSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Live captions */}
      <LiveCaptions isEnabled={captionsEnabled} />

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
    </div>
  );
}
