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
  /** Whether the local user is screen sharing */
  isScreenSharing?: boolean;
  /** Whether the remote peer is screen sharing */
  remoteIsScreenSharing?: boolean;
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
  isScreenSharing = false,
  remoteIsScreenSharing = false,
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
    const remoteLabel = remoteIsScreenSharing
      ? `${isLocalTutor ? studentLabel : tutorLabel} (Screen)`
      : (isLocalTutor ? studentLabel : tutorLabel);
    const remoteMetrics = isLocalTutor ? studentMetrics : tutorMetrics;

    return (
      <div className="w-full h-full p-3 bg-[#0d0d1a] relative">
        <VideoTile
          name={remoteLabel}
          stream={remoteStream}
          isSpeaking={remoteMetrics.isSpeaking}
          eyeContactScore={remoteIsScreenSharing ? undefined : remoteMetrics.eyeContactScore}
          isMuted={isLocalTutor}
          isLocal={false}
          engagementScore={remoteIsScreenSharing ? undefined : engagementScore}
          studentState={!isLocalTutor && !remoteIsScreenSharing ? (studentState as StudentState) : undefined}
          isActiveSpeaker={true}
          showOverlays={showOverlays && !remoteIsScreenSharing}
          className="w-full h-full"
        />
        {remoteIsScreenSharing && (
          <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-blue-600/80 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Screen Sharing
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'gallery') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 w-full h-full bg-[#0d0d1a]" style={{ minHeight: 0 }}>
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

  // Speaker mode - screen share takes priority as main view, otherwise active speaker fills the screen
  // When screen sharing locally, the local stream's video track has been replaced with screen content
  const screenShareIsMain = isScreenSharing;
  const isActiveSpeakerTutor = screenShareIsMain ? (localRole === 'tutor') : activeSpeaker === 'tutor';
  const mainStream = isActiveSpeakerTutor ? tutorStream : studentStream;
  const mainLabel = screenShareIsMain
    ? `${localRole === 'tutor' ? tutorLabel : studentLabel} (Screen)`
    : (isActiveSpeakerTutor ? tutorLabel : studentLabel);
  const mainMetrics = isActiveSpeakerTutor ? tutorMetrics : studentMetrics;
  const mainIsSpeaking = screenShareIsMain ? false : mainMetrics.isSpeaking;
  const mainEyeContact = screenShareIsMain ? undefined : mainMetrics.eyeContactScore;
  const mainIsLocal = localRole === (isActiveSpeakerTutor ? 'tutor' : 'student');
  const mainVideoSrc = !mainStream && !isActiveSpeakerTutor ? demoVideoSrc : undefined;

  return (
    <div className="w-full h-full p-3 bg-[#0d0d1a] relative">
      <VideoTile
        name={mainLabel}
        stream={mainStream}
        videoSrc={mainVideoSrc}
        isSpeaking={mainIsSpeaking}
        eyeContactScore={mainEyeContact}
        isMuted={isActiveSpeakerTutor}
        isLocal={mainIsLocal}
        engagementScore={screenShareIsMain ? undefined : engagementScore}
        studentState={isActiveSpeakerTutor || screenShareIsMain ? undefined : (studentState as StudentState)}
        isActiveSpeaker={true}
        showOverlays={showOverlays && !screenShareIsMain}
        className="w-full h-full"
      />
      {screenShareIsMain && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-blue-600/80 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          You are sharing your screen
        </div>
      )}
    </div>
  );
}
