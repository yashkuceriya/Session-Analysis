'use client';

import { useEffect, useRef } from 'react';

interface WaitingRoomProps {
  roomTopic?: string;
  tutorName?: string;
  onCancel: () => void;
  isMicEnabled?: boolean;
  isCameraEnabled?: boolean;
  onMicToggle?: () => void;
  onCameraToggle?: () => void;
  videoRef?: React.RefObject<HTMLVideoElement>;
}

export function WaitingRoom({
  roomTopic = 'Tutoring Session',
  tutorName = 'Tutor',
  onCancel,
  isMicEnabled = true,
  isCameraEnabled = true,
  onMicToggle,
  onCameraToggle,
  videoRef,
}: WaitingRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isCameraEnabled || !localVideoRef.current) return;

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: false,
        });

        mediaStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to get camera:', err);
      }
    };

    getMedia();

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCameraEnabled]);

  // Sync with external ref if provided
  useEffect(() => {
    if (videoRef && localVideoRef.current) {
      videoRef.current = localVideoRef.current;
    }
  }, [videoRef]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex flex-col items-center justify-center p-4 z-50">
      {/* Background gradient decoration */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <span className="text-5xl">🎓</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Waiting Room</h1>
          <p className="text-gray-400">Preparing to join the session</p>
        </div>

        {/* Session info */}
        <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 mb-6 border border-gray-700">
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase">Session Topic</p>
            <p className="text-lg font-semibold text-white mt-1">{roomTopic}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase">Tutor</p>
            <p className="text-lg font-semibold text-white mt-1">{tutorName}</p>
          </div>
        </div>

        {/* Video preview */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Camera preview</p>
          <div className="relative rounded-xl overflow-hidden bg-gray-800 border border-gray-700 aspect-video flex items-center justify-center">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isCameraEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="text-gray-300 text-sm">Camera is off</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mic status */}
        <div className="mb-6 p-4 rounded-xl bg-gray-800/30 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${isMicEnabled ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm text-gray-300">
                {isMicEnabled ? 'Microphone ready' : 'Microphone disabled'}
              </span>
            </div>
            <button
              onClick={onMicToggle}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              {isMicEnabled ? 'Mute' : 'Unmute'}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3 mb-6">
          <button
            onClick={onCameraToggle}
            className={`w-full py-3 rounded-lg font-medium transition-colors ${
              isCameraEnabled
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          </button>
        </div>

        {/* Status message */}
        <div className="p-4 rounded-lg bg-blue-950/30 border border-blue-900/50 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0 animate-pulse" />
            <p className="text-sm text-blue-300">
              Waiting for the tutor to let you in...
            </p>
          </div>
        </div>

        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-lg font-medium bg-gray-700/50 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Style for animations */}
      <style jsx>{`
        @keyframes pulse-custom {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse-custom 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
