'use client';

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Layout & Video
import { VideoLayout } from '@/components/session/VideoLayout';
import { FloatingSelfView } from '@/components/session/FloatingSelfView';
import { ControlsBar } from '@/components/session/ControlsBar';
import { SessionSkeleton } from '@/components/session/SessionSkeleton';
import { SessionTimer } from '@/components/session/SessionTimer';
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

  // Student role should NOT see analysis panels
  const isTutor = role === 'tutor' || !isRoomMode;

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
  const { isSharing, startSharing, stopSharing } = useScreenShare();

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

  // Keep face mesh video elements attached to streams (separate from UI elements)
  // These hidden video elements are exclusively for face detection processing
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      if (localVideoRef.current.paused) {
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el) return;

    // In room mode with remote stream: attach the stream
    if (remoteStream) {
      if (el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
      }
      if (el.paused) {
        el.play().catch(() => {});
      }
    }
    // In solo mode: attach the demo video
    else if (!isRoomMode) {
      const demoSrc = '/demo/student-sample.mp4';
      if (el.src !== demoSrc) {
        el.srcObject = null;
        el.src = demoSrc;
        el.loop = true;
        el.muted = true;
      }
      if (el.paused) {
        el.play().catch(() => {});
      }
    }
  }, [remoteStream, isRoomMode]);

  // Play remote audio through a separate (unmuted) audio element for reliable playback
  useEffect(() => {
    if (!remoteStream || !remoteAudioRef.current) return;
    const audio = remoteAudioRef.current;
    audio.srcObject = remoteStream;

    const tryPlay = () => {
      audio.play().catch(() => {
        // Autoplay blocked — need user gesture
        const handler = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click', handler);
          document.removeEventListener('touchstart', handler);
        };
        document.addEventListener('click', handler, { once: true });
        document.addEventListener('touchstart', handler, { once: true });
      });
    };

    tryPlay();
    // Also retry when tracks become active
    remoteStream.getTracks().forEach(track => {
      track.addEventListener('unmute', tryPlay, { once: true });
    });

    // Periodic retry for stubborn autoplay policies (especially iPad)
    const retryInterval = setInterval(() => {
      if (audio.paused && audio.srcObject) {
        audio.play().catch(() => {});
      }
    }, 2000);

    return () => clearInterval(retryInterval);
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
        // Session end: tutor ended the session — navigate student to session-ended page
        if (msg.type === 'end-session' && typeof msg.data === 'object' && msg.data !== null) {
          setCallState('ended');
          endSession();
          peerRef.current?.stop();
          // Students go to session-ended page, not analytics
          router.push(`/session-ended?role=${role}`);
          return; // Don't process further messages
        }
        // Timer sync: student receives tutor's startTime and sessionId
        if (msg.type === 'sync' && typeof msg.data === 'object' && msg.data !== null) {
          const syncData = msg.data as { startTime: number; sessionId?: string; sessionConfig?: any };
          if (role === 'student') {
            const updates: any = {};
            if (syncData.startTime) updates.startTime = syncData.startTime;
            if (syncData.sessionId) updates.sessionId = syncData.sessionId;
            if (syncData.sessionConfig) updates.sessionConfig = syncData.sessionConfig;
            if (Object.keys(updates).length > 0) {
              useSessionStore.setState(updates);
            }
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
  }, [isRoomMode, roomId, role, localStream, streamReady, setCallState, endSession, router]);

  // Timer sync: tutor periodically sends session state to student
  useEffect(() => {
    if (!peerConnected || !peerRef.current || role !== 'tutor') return;

    const sendSync = () => {
      const state = useSessionStore.getState();
      peerRef.current?.sendData({
        type: 'sync',
        data: {
          startTime: state.startTime,
          sessionId: state.sessionId,
          sessionConfig: state.sessionConfig,
        },
        timestamp: Date.now(),
      });
    };

    // Send immediately
    sendSync();

    // Then every 3 seconds for reliable delivery
    const interval = setInterval(sendSync, 3000);

    return () => clearInterval(interval);
  }, [peerConnected, role]);

  // Solo/demo mode: VideoTile now handles demo video via demoVideoSrc prop
  // passed through VideoLayout — no manual ref manipulation needed.

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
  const handleStopScreenShare = useCallback(() => {
    stopSharing();

    // Restore camera track in peer connection
    if (peerRef.current && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const senders = peerRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(videoTrack).catch(() => {});
        }
      }
    }

    // Restore self-view to camera
    if (selfViewRef.current && localStream) {
      selfViewRef.current.srcObject = localStream;
    }
  }, [stopSharing, localStream]);

  const handleStartScreenShare = useCallback(async () => {
    const screenStream = await startSharing();
    if (!screenStream) return;

    // Replace video track in peer connection
    if (peerRef.current && localStream) {
      const screenTrack = screenStream.getVideoTracks()[0];
      if (screenTrack) {
        const senders = peerRef.current.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack).catch(() => {});
        }

        // Auto-restore camera when user clicks native "Stop sharing" button
        screenTrack.addEventListener('ended', () => {
          handleStopScreenShare();
        });
      }
    }

    // Update the self-view to show screen share
    if (selfViewRef.current) {
      selfViewRef.current.srcObject = screenStream;
    }
  }, [startSharing, localStream, handleStopScreenShare]);

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

    // Broadcast session end to all peers BEFORE stopping connection
    if (peerRef.current && isRoomMode) {
      peerRef.current.sendData({
        type: 'end-session',
        data: { sessionId: sid },
        timestamp: Date.now(),
      });
    }

    // Navigate IMMEDIATELY — don't wait for saves
    setCallState('ended');
    endSession();
    peerRef.current?.stop();
    // Tutor goes to analytics, student goes to session-ended
    if (isTutor) {
      router.push(`/analytics/${sid}`);
    } else {
      router.push(`/session-ended?role=${role}`);
    }

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

  // Role-aware stream mapping — passed directly to VideoTile for reliable playback
  const tutorStream = role === 'tutor' ? localStream : remoteStream;
  const studentStream = role === 'student' ? localStream : remoteStream;

  // Combined metrics history for timeline
  const fullHistory = useMemo(() => [...metricsArchive, ...metricsHistory], [metricsArchive, metricsHistory]);

  if (!streamReady && !streamError) {
    return <SessionSkeleton />;
  }

  if (streamError) {
    return (
      <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center relative overflow-hidden">
        {/* Background glow effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        <div className="text-center max-w-md relative z-10">
          <div className="text-7xl mb-8 animate-bounce">📷</div>
          <h2 className="text-white text-3xl font-bold mb-4">Camera Access Required</h2>
          <p className="text-gray-300 mb-6 leading-relaxed text-base">
            Please allow camera and microphone access to start the session.
          </p>
          <p className="text-gray-400 text-sm mb-8 bg-gray-800/60 backdrop-blur-lg rounded-xl px-5 py-3 border border-gray-700/50">{streamError}</p>
          <button
            onClick={() => startStream()}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 active:scale-95"
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

      {/* Room mode status bar — centered top, glassmorphic */}
      {isRoomMode && (
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center px-4 py-3 bg-gray-900/50 backdrop-blur-xl border-b border-gray-800/30">
          <div className="flex items-center gap-8 max-w-2xl w-full">
            {/* Left: Room info */}
            <div className="flex items-center gap-3 flex-1">
              <span className="text-gray-500 text-xs font-mono bg-gray-800/50 px-2.5 py-1 rounded-lg">
                {roomId}
              </span>
              <button
                onClick={() => {
                  const joinUrl = `${window.location.origin}/join/${roomId}`;
                  navigator.clipboard.writeText(joinUrl).then(() => {
                    // Show brief copied feedback (tooltip would be nice)
                  });
                }}
                className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors hover:underline"
              >
                Copy Link
              </button>
            </div>

            {/* Center: Timer */}
            <div className="flex items-center gap-2">
              <SessionTimer />
            </div>

            {/* Right: Connection status */}
            <div className="flex items-center gap-3 flex-1 justify-end">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                  peerConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                }`} />
                <span className={`text-xs font-medium ${peerConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                  {peerConnected ? 'Connected' : 'Waiting...'}
                </span>
              </div>
              {peerConnected && (
                <div className="flex items-center gap-2 pl-3 border-l border-gray-700/50">
                  <QualityIndicator quality={streamQuality} bandwidth={streamBandwidth} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Waiting for peer overlay */}
      {isRoomMode && !peerConnected && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-950 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">
              {role === 'student' ? 'Waiting for your tutor to join...' : 'Waiting for student to join...'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">Share the invite link to get started</p>
            <div className="inline-flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-800">
              <span className="text-gray-500 text-xs font-mono">{roomId}</span>
              <button
                onClick={() => {
                  const joinUrl = `${window.location.origin}/join/${roomId}`;
                  navigator.clipboard.writeText(joinUrl).then(() => {
                    // Copied
                  });
                }}
                className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: video-first layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video area — flex-1 + min-h-0 ensures tiles fill height */}
        <div className="flex-1 relative min-h-0 min-w-0">
          {/* Video layout — optionally wrapped with engagement ring */}
          {isTutor && isAnalysisVisible ? (
            <EngagementRing engagementScore={currentMetrics?.engagementScore ?? 50}>
              <VideoLayout
                tutorVideoRef={tutorVideoRef}
                studentVideoRef={studentVideoRef}
                localVideoRef={localVideoRef}
                tutorStream={tutorStream}
                studentStream={studentStream}
                demoVideoSrc={!isRoomMode ? '/demo/student-sample.mp4' : undefined}
                tutorLabel={tutorLabel}
                studentLabel={studentLabel}
                viewMode={viewMode}
                activeSpeaker={activeSpeaker}
                showOverlays={true}
                localRole={role}
                isRoomMode={isRoomMode}
              />
            </EngagementRing>
          ) : (
            <VideoLayout
              tutorVideoRef={tutorVideoRef}
              studentVideoRef={studentVideoRef}
              localVideoRef={localVideoRef}
              tutorStream={tutorStream}
              studentStream={studentStream}
              demoVideoSrc={!isRoomMode ? '/demo/student-sample.mp4' : undefined}
              tutorLabel={tutorLabel}
              studentLabel={studentLabel}
              viewMode={viewMode}
              activeSpeaker={activeSpeaker}
              showOverlays={isTutor && isAnalysisVisible}
              localRole={role}
              isRoomMode={isRoomMode}
            />
          )}

          {/* Analysis overlays — only visible to tutors when analysis is enabled */}
          {isTutor && isAnalysisVisible && (
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

        {/* Floating self-view in speaker mode or always in room mode */}
        {(viewMode === 'speaker' || isRoomMode) && (
          <FloatingSelfView
            videoRef={selfViewRef}
            stream={localStream}
            name={localLabel || 'You'}
            isMuted={!isMicEnabled}
            eyeContactScore={role === 'tutor' ? currentMetrics?.tutor.eyeContactScore : currentMetrics?.student.eyeContactScore}
          />
        )}

        {/* Sidebar (when toggled — analytics panel) — only visible to tutors */}
        {isTutor && isSidebarOpen && (
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

      {/* Metrics HUD overlay — only visible to tutors when both HUD and analysis are enabled */}
      <MetricsHUD visible={isTutor && isHudVisible && isAnalysisVisible} />

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
        isTutor={isTutor}
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

      {/* Hidden video elements for face mesh processing — always attached to streams, decoupled from UI layout */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
      />
      {remoteStream && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}
