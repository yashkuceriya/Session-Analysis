'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hook that runs Web Speech API recognition during an active session.
 * Tags segments as 'tutor' or 'student' using a voting window over
 * recent VAD states (more accurate than single-frame check).
 */
export function useSessionTranscript(enabled: boolean, onTranscript?: (text: string) => void) {
  const isActive = useSessionStore((s) => s.isActive);
  const addSegment = useSessionStore((s) => s.addTranscriptSegment);
  const recognitionRef = useRef<any>(null);
  const isRunningRef = useRef(false);
  // Track recent speaking states for better speaker attribution
  const speakerVotesRef = useRef<Array<{ tutor: boolean; student: boolean; time: number }>>([]);

  // Collect VAD states every 200ms for speaker voting
  useEffect(() => {
    if (!enabled || !isActive) return;
    const interval = setInterval(() => {
      const metrics = useSessionStore.getState().currentMetrics;
      if (!metrics) return;
      speakerVotesRef.current.push({
        tutor: metrics.tutor.isSpeaking,
        student: metrics.student.isSpeaking,
        time: Date.now(),
      });
      // Keep last 5 seconds of votes
      const cutoff = Date.now() - 5000;
      speakerVotesRef.current = speakerVotesRef.current.filter(v => v.time > cutoff);
    }, 200);
    return () => clearInterval(interval);
  }, [enabled, isActive]);

  const determineSpeaker = useCallback((): 'tutor' | 'student' => {
    const votes = speakerVotesRef.current;
    if (votes.length === 0) return 'tutor';

    // Count recent speaking frames (last 2 seconds most relevant)
    const recentCutoff = Date.now() - 2000;
    const recent = votes.filter(v => v.time > recentCutoff);
    if (recent.length === 0) return 'tutor';

    const tutorFrames = recent.filter(v => v.tutor && !v.student).length;
    const studentFrames = recent.filter(v => v.student && !v.tutor).length;

    // If student was speaking more recently, attribute to student
    if (studentFrames > tutorFrames) return 'student';
    return 'tutor';
  }, []);

  const startRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.language = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text.length < 2) continue;

          const speaker = determineSpeaker();

          addSegment({
            speaker,
            text,
            timestamp: Date.now(),
          });

          if (onTranscript) {
            onTranscript(text);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      // Restart on recoverable errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // Expected — just let onend restart it
      }
    };

    recognition.onend = () => {
      if (isRunningRef.current) {
        // Auto-restart with small delay to avoid rapid restarts
        setTimeout(() => {
          if (isRunningRef.current) {
            try { recognition.start(); } catch { /* already running */ }
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      isRunningRef.current = true;
    } catch {
      // Not supported or permission denied
    }
  }, [addSegment, onTranscript, determineSpeaker]);

  const stopRecognition = useCallback(() => {
    isRunningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    speakerVotesRef.current = [];
  }, []);

  useEffect(() => {
    if (enabled && isActive) {
      startRecognition();
    } else {
      stopRecognition();
    }
    return () => stopRecognition();
  }, [enabled, isActive, startRecognition, stopRecognition]);
}
