'use client';

import { create } from 'zustand';
import { MetricSnapshot, SessionType } from '@/lib/metrics-engine/types';
import { Nudge, CoachingConfig, DEFAULT_COACHING_CONFIG } from '@/lib/coaching-system/types';
import { SessionConfig } from '@/lib/session/types';

const MAX_METRICS_HISTORY = 1200; // ~10 minutes at 2Hz
const DOWNSAMPLE_THRESHOLD = 600; // Start downsampling after 5 min

type CallState = 'waiting' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'ended';

interface LatencyBreakdown {
  faceMeshMs: number;
  audioMs: number;
  metricsMs: number;
  coachingMs: number;
  totalMs: number;
}

interface SessionState {
  // Session
  sessionId: string | null;
  sessionConfig: SessionConfig;
  isActive: boolean;
  startTime: number | null;

  // Real-time metrics
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  metricsArchive: MetricSnapshot[]; // Downsampled older metrics for analytics

  // Nudges
  activeNudges: Nudge[];
  nudgeHistory: Nudge[];
  coachingConfig: CoachingConfig;

  // UI
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isSidebarOpen: boolean;
  viewMode: 'speaker' | 'gallery';
  isHudVisible: boolean;
  isAnalysisVisible: boolean;
  isChatOpen: boolean;
  isRecording: boolean;
  callState: CallState;

  // Latency
  processingLatencyMs: number;
  latencyBreakdown: LatencyBreakdown;
  latencyHistory: number[]; // Last 100 latency values for p50/p95/p99

  // Actions
  startSession: (config: SessionConfig) => void;
  endSession: () => void;
  pushMetrics: (snapshot: MetricSnapshot) => void;
  addNudge: (nudge: Nudge) => void;
  dismissNudge: (id: string) => void;
  updateCoachingConfig: (config: Partial<CoachingConfig>) => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleSidebar: () => void;
  setViewMode: (mode: 'speaker' | 'gallery') => void;
  toggleHud: () => void;
  toggleAnalysis: () => void;
  toggleChat: () => void;
  setRecording: (val: boolean) => void;
  setLatency: (ms: number) => void;
  setLatencyBreakdown: (breakdown: LatencyBreakdown) => void;
  setCallState: (state: CallState) => void;
  getFullHistory: () => MetricSnapshot[];
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  sessionConfig: {
    subject: '',
    sessionType: 'discussion' as SessionType,
    studentLevel: '',
    tutorName: 'Tutor',
    studentName: 'Student',
  },
  isActive: false,
  startTime: null,
  currentMetrics: null,
  metricsHistory: [],
  metricsArchive: [],
  activeNudges: [],
  nudgeHistory: [],
  coachingConfig: DEFAULT_COACHING_CONFIG,
  isMicEnabled: true,
  isCameraEnabled: true,
  isSidebarOpen: false,
  viewMode: 'gallery',
  isHudVisible: false,
  isAnalysisVisible: true,
  isChatOpen: false,
  isRecording: false,
  callState: 'waiting',
  processingLatencyMs: 0,
  latencyBreakdown: { faceMeshMs: 0, audioMs: 0, metricsMs: 0, coachingMs: 0, totalMs: 0 },
  latencyHistory: [],

  startSession: (config) =>
    set({
      sessionId: `session-${Date.now()}`,
      sessionConfig: config,
      isActive: true,
      startTime: Date.now(),
      currentMetrics: null,
      metricsHistory: [],
      metricsArchive: [],
      activeNudges: [],
      nudgeHistory: [],
      latencyHistory: [],
    }),

  endSession: () =>
    set({ isActive: false }),

  pushMetrics: (snapshot) =>
    set((state) => {
      const history = state.metricsHistory;
      let newHistory: MetricSnapshot[];
      let newArchive = state.metricsArchive;

      if (history.length >= MAX_METRICS_HISTORY) {
        // Move oldest 1/3 to archive (downsampled: keep every 10th)
        const pruneCount = Math.floor(MAX_METRICS_HISTORY / 3);
        const toArchive = history.slice(0, pruneCount);
        const downsampled = toArchive.filter((_, i) => i % 10 === 0);
        newArchive = [...state.metricsArchive, ...downsampled];
        newHistory = [...history.slice(pruneCount), snapshot];
      } else {
        newHistory = [...history, snapshot];
      }

      return {
        currentMetrics: snapshot,
        metricsHistory: newHistory,
        metricsArchive: newArchive,
      };
    }),

  addNudge: (nudge) =>
    set((state) => ({
      activeNudges: [...state.activeNudges, nudge],
      nudgeHistory: [...state.nudgeHistory, nudge],
    })),

  dismissNudge: (id) =>
    set((state) => ({
      activeNudges: state.activeNudges.filter((n) => n.id !== id),
    })),

  updateCoachingConfig: (config) =>
    set((state) => ({
      coachingConfig: { ...state.coachingConfig, ...config },
    })),

  toggleMic: () => set((state) => ({ isMicEnabled: !state.isMicEnabled })),
  toggleCamera: () => set((state) => ({ isCameraEnabled: !state.isCameraEnabled })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
  toggleHud: () => set((state) => ({ isHudVisible: !state.isHudVisible })),
  toggleAnalysis: () => set((state) => ({ isAnalysisVisible: !state.isAnalysisVisible })),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),
  setRecording: (val) => set({ isRecording: val }),

  setLatency: (ms) =>
    set((state) => {
      const history = state.latencyHistory.length >= 100
        ? [...state.latencyHistory.slice(-99), ms]
        : [...state.latencyHistory, ms];
      return { processingLatencyMs: ms, latencyHistory: history };
    }),

  setLatencyBreakdown: (breakdown) =>
    set({ latencyBreakdown: breakdown }),

  setCallState: (state) => set({ callState: state }),

  getFullHistory: () => {
    const state = get();
    return [...state.metricsArchive, ...state.metricsHistory];
  },

  reset: () =>
    set({
      sessionId: null,
      isActive: false,
      startTime: null,
      currentMetrics: null,
      metricsHistory: [],
      metricsArchive: [],
      activeNudges: [],
      nudgeHistory: [],
      callState: 'waiting',
      processingLatencyMs: 0,
      latencyBreakdown: { faceMeshMs: 0, audioMs: 0, metricsMs: 0, coachingMs: 0, totalMs: 0 },
      latencyHistory: [],
    }),
}));
