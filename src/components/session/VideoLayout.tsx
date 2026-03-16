'use client';

import { RefObject } from 'react';
import { VideoTile } from './VideoTile';
import { useSessionStore } from '@/stores/sessionStore';
import { StudentState } from '@/lib/metrics-engine/types';

interface VideoLayoutProps {
  tutorVideoRef?: RefObject<HTMLVideoElement | null>;
  studentVideoRef?: RefObject<HTMLVideoElement | null>;
  localVideoRef?: RefObject<HTMLVideoElement | null>;
  /** MediaStream for tutor's video — passed directly to VideoTile for reliable playback */
  tutorStream?: MediaStream | null;
  /** MediaStream for student's video — passed directly to VideoTile for reliable playback */
  studentStream?: MediaStream | null;
  /** Fallback video src for demo/solo mode */
  demoVideoSrc?: string;
  tutorLabel?: string;
  studentLabel?: string;
  viewMode: 'speaker' | 'gallery';
  activeSpeaker: 'tutor' | 'student';
  showOverlays?: boolean;
  localRole?: 'tutor' | 'student';
  isRoomMode?: boolean;
}

export function VideoLayout({
  tutorVideoRef,
  studentVideoRef,
  tutorLabel = 'Tutor',
  studentLabel = 'Student',
  tutorStream,
  studentStream,
  demoVideoSrc,
  viewMode,
  activeSpeaker,
  showOverlays = true,
  localRole = 'tutor',
  isRoomMode = false,
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

  // Room mode: show only the remote person's video full-screen
  if (isRoomMode) {
    const isLocalTutor = localRole === 'tutor';
    // For tutor: remote = student, for student: remote = tutor
    const remoteStream = isLocalTutor ? studentStream : tutorStream;
    const remoteLabel = isLocalTutor ? studentLabel : tutorLabel;
    const remoteMetrics = isLocalTutor ? studentMetrics : tutorMetrics;

    return (
      <div className="w-full h-full p-3 bg-[#0a0a12]">
        <VideoTile
          name={remoteLabel}
          stream={remoteStream}
          isSpeaking={remoteMetrics.isSpeaking}
          eyeContactScore={remoteMetrics.eyeContactScore}
          isMuted={isLocalTutor}
          isLocal={false}
          engagementScore={engagementScore}
          studentState={!isLocalTutor ? (studentState as StudentState) : undefined}
          isActiveSpeaker={true}
          showOverlays={showOverlays}
          className="w-full h-full"
        />
      </div>
    );
  }

  if (viewMode === 'gallery') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 w-full h-full bg-[#0a0a12]" style={{ minHeight: 0 }}>
        {/* Tutor tile */}
        <VideoTile
          name={tutorLabel}
          stream={tutorStream}
          isSpeaking={tutorMetrics.isSpeaking}
          eyeContactScore={tutorMetrics.eyeContactScore}
          isMuted={true}
          isLocal={localRole === 'tutor'}
          engagementScore={engagementScore}
          isActiveSpeaker={activeSpeaker === 'tutor'}
          showOverlays={showOverlays}
          className="w-full h-full"
        />

        {/* Student tile */}
        <VideoTile
          name={studentLabel}
          stream={studentStream}
          videoSrc={!studentStream ? demoVideoSrc : undefined}
          isSpeaking={studentMetrics.isSpeaking}
          eyeContactScore={studentMetrics.eyeContactScore}
          isMuted={false}
          isLocal={localRole === 'student'}
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
  const mainStream = isActiveSpeakerTutor ? tutorStream : studentStream;
  const mainLabel = isActiveSpeakerTutor ? tutorLabel : studentLabel;
  const mainMetrics = isActiveSpeakerTutor ? tutorMetrics : studentMetrics;
  const mainIsSpeaking = mainMetrics.isSpeaking;
  const mainEyeContact = mainMetrics.eyeContactScore;
  const mainIsLocal = localRole === activeSpeaker;
  const mainVideoSrc = !mainStream && !isActiveSpeakerTutor ? demoVideoSrc : undefined;

  return (
    <div className="w-full h-full p-3 bg-[#0a0a12]">
      <VideoTile
        name={mainLabel}
        stream={mainStream}
        videoSrc={mainVideoSrc}
        isSpeaking={mainIsSpeaking}
        eyeContactScore={mainEyeContact}
        isMuted={isActiveSpeakerTutor}
        isLocal={mainIsLocal}
        engagementScore={engagementScore}
        studentState={isActiveSpeakerTutor ? undefined : (studentState as StudentState)}
        isActiveSpeaker={true}
        showOverlays={showOverlays}
        className="w-full h-full"
      />
    </div>
  );
}
