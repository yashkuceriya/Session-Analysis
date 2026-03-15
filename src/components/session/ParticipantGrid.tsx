'use client';

import { useRef, useEffect, useMemo } from 'react';
import { VideoTile } from './VideoTile';
import { Participant } from '@/stores/participantStore';

interface ParticipantGridProps {
  participants: Participant[];
  activeSpeakerId?: string;
  showOverlays?: boolean;
  videoRefs?: Map<string, React.RefObject<HTMLVideoElement>>;
}

/**
 * Dynamic grid layout that adapts based on participant count:
 * - 1: full screen
 * - 2: side by side (50/50)
 * - 3-4: 2x2 grid
 * - 5-6: 2x3 grid
 * - 7-8: optimized 2x4 or 3x3 minus corner
 */
export function ParticipantGrid({
  participants,
  activeSpeakerId,
  showOverlays = true,
  videoRefs = new Map(),
}: ParticipantGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Calculate grid layout based on participant count
  const gridConfig = useMemo(() => {
    const count = participants.length;

    if (count === 0)
      return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' };
    if (count === 1)
      return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' };
    if (count === 2)
      return { cols: 2, rows: 1, className: 'grid-cols-2 grid-rows-1' };
    if (count === 3)
      return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' };
    if (count === 4)
      return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' };
    if (count === 5)
      return { cols: 3, rows: 2, className: 'grid-cols-3 grid-rows-2' };
    if (count === 6)
      return { cols: 3, rows: 2, className: 'grid-cols-3 grid-rows-2' };
    if (count === 7)
      return { cols: 4, rows: 2, className: 'grid-cols-4 grid-rows-2' };
    // 8 participants
    return { cols: 4, rows: 2, className: 'grid-cols-4 grid-rows-2' };
  }, [participants.length]);

  // Sort participants: tutors first, then by engagement score
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Tutor first
      if (a.role !== b.role) {
        return a.role === 'tutor' ? -1 : 1;
      }
      // Then by engagement
      return b.engagementScore - a.engagementScore;
    });
  }, [participants]);

  return (
    <div
      ref={containerRef}
      className={`grid ${gridConfig.className} gap-2 h-full w-full p-2 bg-gray-950`}
    >
      {sortedParticipants.map((participant) => {
        const videoRef = videoRefs.get(participant.peerId);
        const isActiveSpeaker = participant.peerId === activeSpeakerId;

        return (
          <div
            key={participant.peerId}
            className="relative rounded-lg overflow-hidden bg-gray-900 transition-all duration-300"
          >
            <VideoTile
              ref={videoRef}
              name={participant.name}
              isSpeaking={participant.isSpeaking}
              eyeContactScore={participant.eyeContactScore}
              isMuted={participant.isMuted}
              isLocal={false}
              engagementScore={participant.engagementScore}
              studentState={
                participant.role === 'student' && participant.studentState ? participant.studentState : undefined
              }
              connectionQuality={participant.connectionQuality}
              isActiveSpeaker={isActiveSpeaker}
              showOverlays={showOverlays}
              className="w-full h-full"
            />

            {/* Tutor crown/star icon overlay */}
            {participant.role === 'tutor' && showOverlays && (
              <div className="absolute top-2 left-2 z-10">
                <div className="text-2xl" title="Tutor">
                  👑
                </div>
              </div>
            )}

            {/* Hand raised indicator */}
            {participant.isHandRaised && showOverlays && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-orange-500/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2 animate-bounce">
                  <span className="text-lg">✋</span>
                  <span className="text-xs font-semibold text-white">Hand raised</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
