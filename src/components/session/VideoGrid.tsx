'use client';

import { RefObject } from 'react';
import { VideoTile } from './VideoTile';
import { useSessionStore } from '@/stores/sessionStore';

interface VideoGridProps {
  tutorVideoRef: RefObject<HTMLVideoElement | null>;
  studentVideoRef: RefObject<HTMLVideoElement | null>;
  tutorLabel?: string;
  studentLabel?: string;
}

export function VideoGrid({ tutorVideoRef, studentVideoRef, tutorLabel, studentLabel }: VideoGridProps) {
  const metrics = useSessionStore((s) => s.currentMetrics);
  const config = useSessionStore((s) => s.sessionConfig);
  const isMicEnabled = useSessionStore((s) => s.isMicEnabled);

  return (
    <div className="grid grid-cols-2 gap-3 h-full p-3">
      <VideoTile
        ref={tutorVideoRef}
        name={tutorLabel || config.tutorName || 'Tutor'}
        isSpeaking={metrics?.tutor.isSpeaking ?? false}
        eyeContactScore={metrics?.tutor.eyeContactScore}
        isMuted={!isMicEnabled}
        isLocal
      />
      <VideoTile
        ref={studentVideoRef}
        name={studentLabel || config.studentName || 'Student'}
        isSpeaking={metrics?.student.isSpeaking ?? false}
        eyeContactScore={metrics?.student.eyeContactScore}
      />
    </div>
  );
}
