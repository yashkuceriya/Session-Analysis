/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/refs */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveCaptions } from '@/hooks/useLiveCaptions';

interface LiveCaptionsProps {
  isEnabled: boolean;
  onTranscript?: (text: string) => void;
}

export function LiveCaptions({
  isEnabled,
  onTranscript,
}: LiveCaptionsProps) {
  const {
    isSupported,
    isListening,
    transcript,
    finalTranscripts,
    start,
    stop,
    error,
  } = useLiveCaptions();

  const [displayLines, setDisplayLines] = useState<string[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEnabled && isSupported) {
      start();
    } else {
      stop();
    }

    return () => {
      if (isListening) {
        stop();
      }
    };
  }, [isEnabled, isSupported]);

  useEffect(() => {
    // Update display lines: keep last 3 lines visible
    const allText = [...finalTranscripts, transcript].filter(Boolean);
    const newLines = allText.slice(-3);
    setDisplayLines(newLines);

    // Call callback with full transcript
    if (onTranscript && transcript) {
      onTranscript(transcript);
    }

    // Auto-scroll
    if (scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop =
            scrollContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [transcript, finalTranscripts, onTranscript]);

  if (!isEnabled || !isSupported) {
    return null;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="fixed bottom-4 left-4 right-4 max-h-32 overflow-y-auto bg-black/70 backdrop-blur rounded-lg p-4 border border-white/10"
      role="log"
      aria-live="polite"
      aria-label="Live captions"
    >
      <div className="flex flex-col gap-2">
        {displayLines.length === 0 && isListening && !transcript && (
          <p className="text-lg text-white/70 italic">Listening...</p>
        )}

        {displayLines.map((line, idx) => (
          <p key={idx} className="text-lg text-white leading-relaxed">
            {line}
          </p>
        ))}

        {error && (
          <p className="text-lg text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
