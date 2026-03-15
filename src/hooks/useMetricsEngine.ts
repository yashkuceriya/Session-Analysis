'use client';

import { useEffect, useRef, useCallback } from 'react';
import { MetricsEngine } from '@/lib/metrics-engine/MetricsEngine';
import { CoachingEngine } from '@/lib/coaching-system/CoachingEngine';
import { FaceFrame } from '@/lib/video-processor/types';
import { VADResult } from '@/lib/audio-processor/types';
import { useSessionStore } from '@/stores/sessionStore';
import { SessionType } from '@/lib/metrics-engine/types';

const UPDATE_INTERVAL_MS = 500; // 2 Hz

interface UseMetricsEngineOptions {
  getTutorFace: () => FaceFrame | null;
  getStudentFace: () => FaceFrame | null;
  getTutorAudio: () => VADResult;
  getStudentAudio: () => VADResult;
  getTutorFaceLatency: () => number;
  getStudentFaceLatency: () => number;
  sessionType: SessionType;
  enabled: boolean;
}

export function useMetricsEngine(options: UseMetricsEngineOptions) {
  const metricsEngineRef = useRef<MetricsEngine | null>(null);
  const coachingEngineRef = useRef<CoachingEngine | null>(null);
  const timerRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pushMetricsRef = useRef(useSessionStore.getState().pushMetrics);
  const addNudgeRef = useRef(useSessionStore.getState().addNudge);
  const setLatencyRef = useRef(useSessionStore.getState().setLatency);
  const setLatencyBreakdownRef = useRef(useSessionStore.getState().setLatencyBreakdown);

  useEffect(() => {
    return useSessionStore.subscribe((state) => {
      pushMetricsRef.current = state.pushMetrics;
      addNudgeRef.current = state.addNudge;
      setLatencyRef.current = state.setLatency;
      setLatencyBreakdownRef.current = state.setLatencyBreakdown;
    });
  }, []);

  const coachingConfig = useSessionStore((s) => s.coachingConfig);

  useEffect(() => {
    if (!options.enabled) return;

    metricsEngineRef.current = new MetricsEngine({ sessionType: options.sessionType });
    coachingEngineRef.current = new CoachingEngine(coachingConfig);

    const tick = () => {
      const o = optionsRef.current;
      const tickStart = performance.now();

      // Face mesh latency (already measured in useFaceMesh)
      const faceMeshMs = Math.max(
        o.getTutorFaceLatency(),
        o.getStudentFaceLatency()
      );

      // Data gathering
      const tutorFace = o.getTutorFace();
      const studentFace = o.getStudentFace();
      const tutorAudio = o.getTutorAudio();
      const studentAudio = o.getStudentAudio();

      const audioMs = performance.now() - tickStart;

      // Metrics computation
      const metricsStart = performance.now();
      const now = Date.now();
      const snapshot = metricsEngineRef.current!.update(
        tutorFace,
        studentFace,
        tutorAudio.isSpeaking,
        studentAudio.isSpeaking,
        tutorAudio.energy,
        studentAudio.energy,
        now
      );
      const metricsMs = performance.now() - metricsStart;

      pushMetricsRef.current(snapshot);

      // Coaching evaluation
      const coachingStart = performance.now();
      const nudges = coachingEngineRef.current!.evaluate(snapshot);
      for (const nudge of nudges) {
        addNudgeRef.current(nudge);
      }
      const coachingMs = performance.now() - coachingStart;

      const totalMs = faceMeshMs + audioMs + metricsMs + coachingMs;
      setLatencyRef.current(totalMs);
      setLatencyBreakdownRef.current({
        faceMeshMs,
        audioMs,
        metricsMs,
        coachingMs,
        totalMs,
      });

      timerRef.current = window.setTimeout(tick, UPDATE_INTERVAL_MS);
    };

    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      metricsEngineRef.current?.reset();
      coachingEngineRef.current?.reset();
    };
  }, [options.enabled, options.sessionType, coachingConfig]);

  const updateCoachingConfig = useCallback(() => {
    coachingEngineRef.current?.updateConfig(coachingConfig);
  }, [coachingConfig]);

  useEffect(() => {
    updateCoachingConfig();
  }, [updateCoachingConfig]);
}
