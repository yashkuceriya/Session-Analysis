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
import { AccessibilityPanel } from '@/components/accessibility/AccessibilityPanel';
import { ChatPanel } from '@/components/session/ChatPanel';
// Recording & Screen Share
import { RecordingIndicator } from '@/components/session/RecordingIndicator';
import { ScreenShareBanner } from '@/components/session/ScreenShareBanner';
import { ReactionOverlay } from '@/components/session/ReactionOverlay';
import { ConnectionRecovery } from '@/components/session/ConnectionRecovery';
import { QualityIndicator } from '@/components/session/QualityIndicator';
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
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
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
  const setCallState = useSessionStore((s) => s.setCallState);
  const callState = useSessionStore((s) => s.callState);

  // Accessibility
  const captionsEnabled = useAccessibilityStore((s) => s.captionsEnabled);

  // Adaptive quality monitoring
  const { quality: streamQuality, bandwidth: streamBandwidth } = useAdaptiveQuality(rtcPeerConnection);

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
  const { isVisible: controlsVisible } = useAutoHide();

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
    if (!isRoomMode) return remoteFaceMesh.getLatestFrame(); // Solo: student is demo video
    if (role === 'student') return localFaceMesh.getLatestFrame(); // Student: own camera is student
    return remoteFaceMesh.getLatestFrame(); // Tutor: student is remote
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
    '!': () => setShowAccessibility(prev => !prev),
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

  // Keep remote video element in sync with remote stream (handles ref changes from re-renders)
  useEffect(() => {
    if (!remoteStream) return;
    const attachRemote = () => {
      const el = remoteVideoRef.current;
      if (el && el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
        el.play().catch(() => {});
      }
    };
    attachRemote();
    const interval = setInterval(attachRemote, 500);
    const onPlaying = () => clearInterval(interval);
    remoteVideoRef.current?.addEventListener('playing', onPlaying);
    return () => {
      clearInterval(interval);
      remoteVideoRef.current?.removeEventListener('playing', onPlaying);
    };
  }, [remoteStream]);

  // Play remote audio through a separate (unmuted) audio element for reliable playback
  useEffect(() => {
    if (!remoteStream || !remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = remoteStream;
    remoteAudioRef.current.play().catch(() => {});
  }, [remoteStream]);

  // Start local media + session on mount
  useEffect(() => {
    const init = async () => {
      await startStream();
      if (!isActive) {
        startSession(sessionConfig);
      }
      setCallState(isRoomMode ? 'waiting' : 'connected');
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local video element in sync with stream (handles ref timing issues)
  useEffect(() => {
    if (!localStream) return;
    const attachStream = () => {
      const el = localVideoRef.current;
      if (el && el.srcObject !== localStream) {
        el.srcObject = localStream;
        // Explicitly call play() — some browsers won't autoplay even with the attribute
        el.play().catch(() => {});
      }
    };
    // Try immediately + retry on interval until attached and playing
    attachStream();
    const interval = setInterval(attachStream, 500);
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
        if (state === 'reconnecting') {
          setConnectionQuality('reconnecting');
          setCallState('reconnecting');
        } else if (state === 'connected') {
          setConnectionQuality('good');
          setCallState('connected');
        } else if (state === 'disconnected') {
          setCallState('waiting');
        } else if (state === 'connecting') {
          setCallState('connecting');
        }
      },
      onDataMessage: (msg) => {
        // Handle incoming data channel messages (chat, reactions)
        if (msg.type === 'chat' && typeof msg.data === 'object' && msg.data !== null) {
          // Could dispatch to chat — for now just log
        }
        // Timer sync: student receives tutor's startTime
        if (msg.type === 'sync' && typeof msg.data === 'object' && msg.data !== null) {
          const syncData = msg.data as { startTime: number };
          if (syncData.startTime && role === 'student') {
            useSessionStore.setState({ startTime: syncData.startTime });
          }
        }
        if (msg.type === 'reaction' && typeof msg.data === 'string') {
          const ALLOWED_EMOJI = new Set(['👍','👎','❤️','😂','🎉','🤔','👏','🔥','💯','✋']);
          const emoji = msg.data as string;
          if (ALLOWED_EMOJI.has(emoji)) {
            setReactions(prev => {
              const next = [...prev, { id: `${Date.now()}-${Math.random()}`, emoji, timestamp: Date.now() }];
              return next.length > 50 ? next.slice(-50) : next;
            });
          }
        }
      },
    });
    peerRef.current = peer;
    peer.start(localStream);
    setRtcPeerConnection(peer.getPeerConnection());

    return () => {
      peer.stop();
      peerRef.current = null;
      setRemoteStream(null);
      setPeerConnected(false);
      setRtcPeerConnection(null);
    };
  }, [isRoomMode, roomId, role, localStream, streamReady]);

  // Timer sync: tutor sends startTime to student when peer connects
  useEffect(() => {
    if (!peerConnected || !peerRef.current || role !== 'tutor') return;
    const sendSync = () => {
      const state = useSessionStore.getState();
      peerRef.current?.sendData({
        type: 'sync',
        data: { startTime: state.startTime },
        timestamp: Date.now(),
      });
    };
    // Try immediately + retry once after DataChannel might have opened
    sendSync();
    const timeout = setTimeout(sendSync, 1500);
    return () => clearTimeout(timeout);
  }, [peerConnected, role]);

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
      localVideoRef.current.srcObject = stream;
      // Replace tracks in peer connection so remote peer sees screen share
      if (peerRef.current && localStream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const senders = peerRef.current.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack).catch(() => {});
          }
        }
      }
    }
  }, [startSharing, localStream]);

  const handleStopScreenShare = useCallback(() => {
    stopSharing();
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      // Restore camera track in peer connection
      if (peerRef.current) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          const senders = peerRef.current.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack).catch(() => {});
          }
        }
      }
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
    setCallState('ended');
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

  // Display names — tutor tile always says tutor name, student tile always says student name
  const tutorLabel = isRoomMode
    ? (role === 'tutor' ? `${sessionConfig.tutorName} (You)` : sessionConfig.tutorName)
    : sessionConfig.tutorName;
  const studentLabel = isRoomMode
    ? (role === 'student' ? `${sessionConfig.studentName} (You)` : sessionConfig.studentName)
    : sessionConfig.studentName;
  // For FloatingSelfView and backward compat
  const localLabel = isRoomMode ? (role === 'tutor' ? 'You (Tutor)' : 'You (Student)') : sessionConfig.tutorName;

  // Role-aware video ref mapping: each role sees their own camera on their own tile
  const tutorVideoRef = role === 'tutor' ? localVideoRef : remoteVideoRef;
  const studentVideoRef = role === 'student' ? localVideoRef : remoteVideoRef;

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
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
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

      {/* Connection recovery overlay */}
      {isRoomMode && (callState === 'reconnecting' || callState === 'connecting') && (
        <ConnectionRecovery
          status={callState === 'reconnecting' ? 'reconnecting' : 'reconnecting'}
          onRetry={() => {
            peerRef.current?.stop();
          }}
        />
      )}

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
          {peerConnected && (
            <QualityIndicator quality={streamQuality} bandwidth={streamBandwidth} />
          )}
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
                tutorVideoRef={tutorVideoRef}
                studentVideoRef={studentVideoRef}
                localVideoRef={localVideoRef}
                tutorLabel={tutorLabel}
                studentLabel={studentLabel}
                viewMode={viewMode}
                activeSpeaker={activeSpeaker}
                showOverlays={true}
                localRole={role}
              />
            </EngagementRing>
          ) : (
            <VideoLayout
              tutorVideoRef={tutorVideoRef}
              studentVideoRef={studentVideoRef}
              localVideoRef={localVideoRef}
              tutorLabel={tutorLabel}
              studentLabel={studentLabel}
              viewMode={viewMode}
              activeSpeaker={activeSpeaker}
              showOverlays={false}
              localRole={role}
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
            videoRef={selfViewRef}
            name={localLabel || 'You'}
            isMuted={!isMicEnabled}
            eyeContactScore={role === 'tutor' ? currentMetrics?.tutor.eyeContactScore : currentMetrics?.student.eyeContactScore}
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
        onStartScreenShare={handleStartScreenShare}
        onStopScreenShare={handleStopScreenShare}
        isScreenSharing={isSharing}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        visible={controlsVisible}
      />

      {/* Settings modal */}
      <NudgeSettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Accessibility settings */}
      <AccessibilityPanel isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} />

      {/* Live captions */}
      <LiveCaptions isEnabled={captionsEnabled} />

      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />

      {/* Hidden audio element — plays remote participant audio (video elements are muted for autoplay) */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
