'use client';

import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Layout & Video
import { VideoLayout } from '@/components/session/VideoLayout';
import { FloatingSelfView } from '@/components/session/FloatingSelfView';
import { ControlsBar } from '@/components/session/ControlsBar';
import { SessionSkeleton } from '@/components/session/SessionSkeleton';
import { MetricsHUD } from '@/components/session/MetricsHUD';
// Analysis Overlays (removed: EngagementRing, StateBadge, NudgeBanner — clean FaceTime-style UI)
// Session panels
import { MetricsSidebar } from '@/components/session/MetricsSidebar';
import { NudgeHistory } from '@/components/session/NudgeHistory';
import { NudgeSettingsPanel } from '@/components/settings/NudgeSettingsPanel';
import { AccessibilityPanel } from '@/components/accessibility/AccessibilityPanel';
import { ChatPanel } from '@/components/session/ChatPanel';
// Recording & Connection
import { RecordingIndicator } from '@/components/session/RecordingIndicator';
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
import { useSessionTranscript } from '@/hooks/useSessionTranscript';
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
  // Face mesh processing video refs (hidden elements, exclusively for face detection)
  const localFaceMeshRef = useRef<HTMLVideoElement>(null);
  const remoteFaceMeshRef = useRef<HTMLVideoElement>(null);
  // Legacy refs kept for backward compat (VideoTile manages its own video elements now)
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

  // Chat: incoming data channel messages collected for useChatChannel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [incomingChatMessages, setIncomingChatMessages] = useState<any[]>([]);

  // Screen share: track whether the remote peer is screen sharing
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);

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

  // Chat — wired to WebRTC DataChannel via PeerConnectionV2
  const chatDataChannelSend = useCallback((msg: any) => {
    if (peerRef.current) {
      peerRef.current.sendData({
        type: 'chat',
        data: msg,
        timestamp: Date.now(),
      });
    }
  }, []);

  const { messages: chatMessages, sendMessage: chatSendMessage, unreadCount, markAsRead } = useChatChannel({
    dataChannelSend: chatDataChannelSend,
    dataChannelMessages: incomingChatMessages,
    userRole: role,
    userName: role === 'tutor' ? sessionConfig.tutorName : sessionConfig.studentName,
  });

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

  // Face mesh on DEDICATED hidden video elements (separate from UI VideoTiles)
  const localFaceMesh = useFaceMesh(localFaceMeshRef, isActive && streamReady);
  const remoteFaceMesh = useFaceMesh(remoteFaceMeshRef, isActive);

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
  const { processTranscript } = useMetricsEngine({
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
    subject: sessionConfig.subject,
    enabled: isActive,
  });

  // Live session transcription (Web Speech API) — feeds transcript to topic relevance tracker
  useSessionTranscript(isActive && isTutor, processTranscript);

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

  // Keep FACE MESH video elements attached to streams (separate from UI VideoTiles)
  // These hidden video elements are exclusively for face detection processing
  useEffect(() => {
    const el = localFaceMeshRef.current;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        el.srcObject = localStream;
      }
      if (el.paused) {
        el.play().catch(() => {});
      }
    }
  }, [localStream]);

  useEffect(() => {
    const el = remoteFaceMeshRef.current;
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
      if (!el.src.endsWith('student-sample.mp4')) {
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
        // Handle incoming data channel messages (chat, reactions, screen share)
        if (msg.type === 'chat' && typeof msg.data === 'object' && msg.data !== null) {
          // Dispatch to useChatChannel hook via state
          setIncomingChatMessages((prev) => [...prev, msg.data]);
        }
        // Screen share state notification from remote peer
        if (msg.type === 'screen-share' && typeof msg.data === 'object' && msg.data !== null) {
          const shareData = msg.data as { active: boolean };
          setRemoteIsScreenSharing(!!shareData.active);
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
        transcriptSegments: s.transcriptSegments,
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

      // Notify remote peer that screen share stopped
      peerRef.current.sendData({
        type: 'screen-share',
        data: { active: false },
        timestamp: Date.now(),
      });
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

        // Notify remote peer that screen share started
        peerRef.current.sendData({
          type: 'screen-share',
          data: { active: true },
          timestamp: Date.now(),
        });

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
        transcriptSegments: state.transcriptSegments,
      }).catch(() => {});
      const unsyncedSnapshots = allMetrics.slice(lastSyncedIndexRef.current);
      fetch(`/api/sessions/${sid}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshots: unsyncedSnapshots,
          nudges: state.nudgeHistory,
          transcript: state.transcriptSegments,
        }),
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
    <div className="h-screen bg-black flex flex-col overflow-hidden relative">
      {/* Recording indicator — small top-left pill */}
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

      {/* Room code + connection dot — tiny floating badge */}
      {isRoomMode && (
        <div className="absolute top-3 right-3 z-30">
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 border border-white/[0.04]">
            <div className={`w-1.5 h-1.5 rounded-full ${
              peerConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-[10px] font-mono text-white/40">{roomId}</span>
          </div>
        </div>
      )}

      {/* Waiting for peer overlay */}
      {isRoomMode && !peerConnected && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/50 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
            <h3 className="text-white text-lg font-medium mb-2">
              {role === 'student' ? 'Waiting for your tutor...' : 'Waiting for student...'}
            </h3>
            <p className="text-white/40 text-sm mb-4">Share the invite link to get started</p>
            <button
              onClick={() => {
                const joinUrl = `${window.location.origin}/join/${roomId}`;
                navigator.clipboard.writeText(joinUrl);
              }}
              className="pointer-events-auto inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/[0.08] text-white/60 hover:text-white/90 hover:bg-white/15 transition-all text-xs"
            >
              <span className="font-mono">{roomId}</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main content: full-bleed video layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video area — edge-to-edge, no padding for maximum screen usage */}
        <div className="flex-1 relative min-h-0 min-w-0">
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
            isScreenSharing={isSharing}
            remoteIsScreenSharing={remoteIsScreenSharing}
          />

          {/* Face model loading indicator */}
          {isActive && !localFaceMesh.isModelLoaded && (
            <div className={`absolute top-3 left-3 z-20 ${localFaceMesh.modelError ? 'bg-red-900/70 text-red-200' : 'bg-black/40 text-white/50'} text-[10px] px-2.5 py-1 rounded-full backdrop-blur-md border border-white/[0.04]`}>
              {localFaceMesh.modelError
                ? `Face detection unavailable: ${localFaceMesh.modelError}`
                : 'Loading face detection...'}
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

        {/* Sidebar (when toggled — analytics panel) — only visible to tutors, defaults closed */}
        {isTutor && isSidebarOpen && (
          <div className="flex flex-col w-72 flex-shrink-0 border-l border-white/[0.06] bg-[#0d0d1a]/95 backdrop-blur-xl overflow-y-auto">
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

      {/* Metrics HUD overlay */}
      {isTutor && <MetricsHUD visible={isHudVisible && isAnalysisVisible} />}

      {/* Floating controls bar — FaceTime-style pill */}
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

      {/* Hidden audio element — plays remote participant audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Hidden video elements for face mesh processing */}
      <video
        ref={localFaceMeshRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '320px', height: '240px', opacity: 0, pointerEvents: 'none' }}
      />
      <video
        ref={remoteFaceMeshRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '320px', height: '240px', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
