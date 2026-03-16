'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSessionStore } from '@/stores/sessionStore';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hook that runs Web Speech API recognition during an active session,
 * automatically tagging segments as 'tutor' or 'student' based on
 * which participant is currently speaking (from real-time metrics).
 */
export function useSessionTranscript(enabled: boolean, onTranscript?: (text: string) => void) {
  const isActive = useSessionStore((s) => s.isActive);
  const addSegment = useSessionStore((s) => s.addTranscriptSegment);
  const recognitionRef = useRef<any>(null);
  const isRunningRef = useRef(false);

  const startRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = false; // Only final results to avoid noise
    recognition.language = 'en-US';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text.length < 2) continue; // Skip very short segments

          // Determine speaker from current metrics
          const metrics = useSessionStore.getState().currentMetrics;
          let speaker: 'tutor' | 'student' = 'tutor';
          if (metrics) {
            // If student is speaking and tutor is not, tag as student
            if (metrics.student.isSpeaking && !metrics.tutor.isSpeaking) {
              speaker = 'student';
            }
          }

          addSegment({
            speaker,
            text,
            timestamp: Date.now(),
          });

          // Forward to topic relevance tracker
          if (onTranscript) {
            onTranscript(text);
          }
        }
      }
    };

    recognition.onerror = () => {
      // Silently restart on error
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (isRunningRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started or permission denied
        }
      }
    };

    try {
      recognition.start();
      isRunningRef.current = true;
    } catch {
      // Permission denied or not supported
    }
  }, [addSegment, onTranscript]);

  const stopRecognition = useCallback(() => {
    isRunningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled && isActive) {
      startRecognition();
    } else {
      stopRecognition();
    }

    return () => {
      stopRecognition();
    };
  }, [enabled, isActive, startRecognition, stopRecognition]);
}
