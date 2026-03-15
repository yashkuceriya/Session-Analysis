'use client';

import { useState } from 'react';
import { Participant, useParticipantStore } from '@/stores/participantStore';

interface ParticipantListProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'tutor' | 'student';
  onMuteParticipant?: (peerId: string) => void;
  onKickParticipant?: (peerId: string) => void;
  onAdmitParticipant?: (peerId: string) => void;
  onDenyParticipant?: (peerId: string) => void;
}

export function ParticipantList({
  isOpen,
  onClose,
  currentUserRole,
  onMuteParticipant,
  onKickParticipant,
  onAdmitParticipant,
  onDenyParticipant,
}: ParticipantListProps) {
  const { participants, waitingRoom } = useParticipantStore();
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(null);

  const participantList = Object.values(participants).sort((a, b) => {
    // Tutors first
    if (a.role !== b.role) {
      return a.role === 'tutor' ? -1 : 1;
    }
    // Then by join order
    return a.joinedAt - b.joinedAt;
  });

  const isTutor = currentUserRole === 'tutor';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-80 bg-gray-900 border-r border-gray-700 z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Participants</h2>
            <button
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Waiting room section */}
          {waitingRoom.length > 0 && isTutor && (
            <div className="mb-6 pb-4 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">
                Waiting room ({waitingRoom.length})
              </h3>
              <div className="space-y-2">
                {waitingRoom.map((entry) => (
                  <div
                    key={entry.peerId}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                      <p className="text-xs text-gray-400">{entry.role}</p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => {
                          onAdmitParticipant?.(entry.peerId);
                        }}
                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                        title="Admit"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          onDenyParticipant?.(entry.peerId);
                        }}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        title="Deny"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participants count */}
          <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
            In session ({participantList.length})
          </div>

          {/* Participants list */}
          <div className="space-y-2">
            {participantList.map((participant) => {
              const isExpanded = expandedParticipant === participant.peerId;

              return (
                <div
                  key={participant.peerId}
                  className="rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedParticipant(isExpanded ? null : participant.peerId)
                    }
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-white">
                          {participant.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>

                      {/* Name and role */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {participant.name}
                          </p>
                          {participant.role === 'tutor' && (
                            <span className="text-lg flex-shrink-0">👑</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Mute/camera status icons */}
                          {participant.isMuted && (
                            <svg
                              className="w-3 h-3 text-red-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M4.172 1.172a4 4 0 015.656 0l4.828 4.828a4 4 0 01-5.656 5.656L4.172 6.828a4 4 0 010-5.656z" />
                            </svg>
                          )}
                          {participant.isCameraOff && (
                            <svg
                              className="w-3 h-3 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                          {participant.isHandRaised && (
                            <span className="text-xs">✋</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Hand raised indicator */}
                    {participant.isHandRaised && (
                      <div className="ml-2 text-orange-500 flex-shrink-0">✋</div>
                    )}

                    {/* Expand arrow */}
                    {isTutor && (
                      <svg
                        className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    )}
                  </button>

                  {/* Expanded actions */}
                  {isExpanded && isTutor && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-700 space-y-2">
                      {participant.role === 'student' && (
                        <>
                          <button
                            onClick={() => onMuteParticipant?.(participant.peerId)}
                            className="w-full px-3 py-2 text-sm text-left rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                          >
                            {participant.isMuted ? 'Unmute' : 'Mute'}
                          </button>
                          <button
                            onClick={() => onKickParticipant?.(participant.peerId)}
                            className="w-full px-3 py-2 text-sm text-left rounded bg-red-700/50 hover:bg-red-700 text-red-100 transition-colors"
                          >
                            Remove from session
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {participantList.length === 0 && waitingRoom.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">No participants yet</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
