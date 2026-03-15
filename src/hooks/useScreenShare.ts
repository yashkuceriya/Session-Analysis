'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function useScreenShare() {
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopSharing = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsSharing(false);
      setError(null);
    }
  }, []);

  const startSharing = useCallback(async (): Promise<MediaStream | null> => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      // Listen for when user clicks "Stop Sharing" in browser UI
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          // Check if all tracks are ended
          const allEnded = stream.getTracks().every((t) => t.readyState === 'ended');
          if (allEnded) {
            stopSharing();
          }
        });
      });

      return stream;
    } catch (err) {
      let message = 'Failed to start screen sharing';
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          message = 'Screen sharing was denied. Please try again.';
        } else if (err.name === 'NotFoundError') {
          message = 'No display devices found.';
        } else if (err.name === 'NotSupportedError') {
          message = 'Screen sharing is not supported in this browser.';
        } else {
          message = err.message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
      setIsSharing(false);
      return null;
    }
  }, [stopSharing]);

  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, [stopSharing]);

  return {
    isSharing,
    screenStream,
    error,
    startSharing,
    stopSharing,
  };
}
