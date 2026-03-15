'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export function useRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [fileSize, setFileSize] = useState(0);

  const updateFileSize = useCallback(() => {
    const totalSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
    setFileSize(totalSize);
  }, []);

  const startRecording = useCallback((streams: MediaStream[]) => {
    try {
      // Create audio context for mixing multiple streams
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const audioDestination = audioContext.createMediaStreamDestination();

      // Collect all video and audio tracks
      let videoTracks: MediaStreamTrack[] = [];

      streams.forEach((stream) => {
        videoTracks = videoTracks.concat(stream.getVideoTracks());

        // Add audio tracks to audio context for mixing
        stream.getAudioTracks().forEach((audioTrack: MediaStreamTrack) => {
          const source = audioContext.createMediaStreamSource(
            new MediaStream([audioTrack])
          );
          source.connect(audioDestination);
        });
      });

      // Create a composite stream with video from first stream and mixed audio
      const compositeStream = new MediaStream();

      // Add video tracks
      if (videoTracks.length > 0) {
        compositeStream.addTrack(videoTracks[0]);
      }

      // Add mixed audio
      audioDestination.stream.getAudioTracks().forEach((track) => {
        compositeStream.addTrack(track);
      });

      // Create MediaRecorder with VP9 + Opus
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      };

      // Fallback if VP9 not supported
      let finalMimeType = options.mimeType;
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        finalMimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(finalMimeType)) {
          finalMimeType = 'video/webm';
        }
      }

      const mediaRecorder = new MediaRecorder(compositeStream, {
        mimeType: finalMimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          updateFileSize();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setFileSize(0);
      setDuration(0);
      setIsPaused(false);

      mediaRecorder.start();
      setIsRecording(true);

      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [updateFileSize]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      const mediaRecorder = mediaRecorderRef.current;

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);
        setIsPaused(false);
        setDuration(0);
        setFileSize(0);

        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Restart duration timer
      durationIntervalRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  // Auto-download helper
  const downloadRecording = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isRecording,
    duration,
    fileSize,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    isPaused,
    downloadRecording,
  };
}
