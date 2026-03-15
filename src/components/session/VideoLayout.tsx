'use client';

import { RefObject } from 'react';
import { VideoTile } from './VideoTile';
import { useSessionStore } from '@/stores/sessionStore';
import { StudentState } from '@/lib/metrics-engine/types';

interface VideoLayoutProps {
  tutorVideoRef: RefObject<HTMLVideoElement | null>;
  studentVideoRef: RefObject<HTMLVideoElement | null>;
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  tutorLabel?: string;
  studentLabel?: string;
  viewMode: 'speaker' | 'gallery';
  activeSpeaker: 'tutor' | 'student';
  showOverlays?: boolean;
}

export function VideoLayout({
  tutorVideoRef,
  studentVideoRef,
  tutorLabel = 'Tutor',
  studentLabel = 'Student',
  viewMode,
  activeSpeaker,
  showOverlays = true,
}: VideoLayoutProps) {
  const currentMetrics = useSessionStore((state) => state.currentMetrics);

  // Extract metrics from store
  const tutorMetrics = currentMetrics?.tutor || {
    eyeContactScore: undefined,
    isSpeaking: false,
    energyScore: 0,
  };

  const studentMetrics = currentMetrics?.student || {
    eyeContactScore: undefined,
    isSpeaking: false,
    energyScore: 0,
  };

  const engagementScore = currentMetrics?.engagementScore ?? 50;
  const studentState = currentMetrics?.studentState ?? 'engaged';

  if (viewMode === 'gallery') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 w-full h-full" style={{ minHeight: 0 }}>
        {/* Tutor tile */}
        <VideoTile
          ref={tutorVideoRef}
          name={tutorLabel}
          isSpeaking={tutorMetrics.isSpeaking}
          eyeContactScore={tutorMetrics.eyeContactScore}
          isMuted={true}
          isLocal={true}
          engagementScore={engagementScore}
          isActiveSpeaker={activeSpeaker === 'tutor'}
          showOverlays={showOverlays}
          className="w-full h-full"
        />

        {/* Student tile */}
        <VideoTile
          ref={studentVideoRef}
          name={studentLabel}
          isSpeaking={studentMetrics.isSpeaking}
          eyeContactScore={studentMetrics.eyeContactScore}
          isMuted={false}
          isLocal={false}
          engagementScore={engagementScore}
          studentState={studentState as StudentState}
          isActiveSpeaker={activeSpeaker === 'student'}
          showOverlays={showOverlays}
          className="w-full h-full"
        />
      </div>
    );
  }

  // Speaker mode - active speaker fills the screen
  const isActiveSpeakerTutor = activeSpeaker === 'tutor';
  const mainVideoRef = isActiveSpeakerTutor ? tutorVideoRef : studentVideoRef;
  const mainLabel = isActiveSpeakerTutor ? tutorLabel : studentLabel;
  const mainMetrics = isActiveSpeakerTutor ? tutorMetrics : studentMetrics;
  const mainIsSpeaking = mainMetrics.isSpeaking;
  const mainEyeContact = mainMetrics.eyeContactScore;

  return (
    <VideoTile
      ref={mainVideoRef}
      name={mainLabel}
      isSpeaking={mainIsSpeaking}
      eyeContactScore={mainEyeContact}
      isMuted={isActiveSpeakerTutor}
      isLocal={isActiveSpeakerTutor}
      engagementScore={engagementScore}
      studentState={isActiveSpeakerTutor ? undefined : (studentState as StudentState)}
      isActiveSpeaker={true}
      showOverlays={showOverlays}
      className="w-full h-full !rounded-none"
    />
  );
}
