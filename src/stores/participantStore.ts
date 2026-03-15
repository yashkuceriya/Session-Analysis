'use client';

import { create } from 'zustand';
import { StudentState } from '@/lib/metrics-engine/types';

export interface Participant {
  peerId: string;
  name: string;
  role: 'tutor' | 'student';
  stream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeaking: boolean;
  isHandRaised: boolean;
  engagementScore: number;
  studentState: StudentState | null;
  eyeContactScore: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'reconnecting';
  joinedAt: number;
}

interface WaitingRoomEntry {
  peerId: string;
  name: string;
  role: 'tutor' | 'student';
  requestedAt: number;
}

export interface ParticipantState {
  // Participant management
  participants: Record<string, Participant>;
  localPeerId: string;
  maxParticipants: number;
  waitingRoom: WaitingRoomEntry[];

  // Actions
  addParticipant: (participant: Participant) => void;
  removeParticipant: (peerId: string) => void;
  updateParticipant: (peerId: string, updates: Partial<Participant>) => void;
  setLocalPeerId: (id: string) => void;
  admitFromWaitingRoom: (peerId: string) => void;
  denyFromWaitingRoom: (peerId: string) => void;
  addToWaitingRoom: (entry: WaitingRoomEntry) => void;
  getParticipantList: () => Participant[];
  getActiveSpeaker: () => Participant | null;
  getParticipantById: (peerId: string) => Participant | null;
  isFull: () => boolean;
  reset: () => void;
}

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  participants: {},
  localPeerId: '',
  maxParticipants: 8,
  waitingRoom: [],

  addParticipant: (participant) =>
    set((state) => {
      const isFull = Object.keys(state.participants).length >= state.maxParticipants;
      if (isFull && participant.peerId !== state.localPeerId) {
        // Add to waiting room instead
        const waitingEntry: WaitingRoomEntry = {
          peerId: participant.peerId,
          name: participant.name,
          role: participant.role,
          requestedAt: Date.now(),
        };
        return {
          waitingRoom: [...state.waitingRoom, waitingEntry],
        };
      }
      return {
        participants: {
          ...state.participants,
          [participant.peerId]: participant,
        },
      };
    }),

  removeParticipant: (peerId) =>
    set((state) => {
      const { [peerId]: _, ...remaining } = state.participants;
      return { participants: remaining };
    }),

  updateParticipant: (peerId, updates) =>
    set((state) => {
      const participant = state.participants[peerId];
      if (!participant) return state;
      return {
        participants: {
          ...state.participants,
          [peerId]: { ...participant, ...updates },
        },
      };
    }),

  setLocalPeerId: (id) => set({ localPeerId: id }),

  addToWaitingRoom: (entry) =>
    set((state) => ({
      waitingRoom: [...state.waitingRoom, entry],
    })),

  admitFromWaitingRoom: (peerId) =>
    set((state) => {
      const entry = state.waitingRoom.find((e) => e.peerId === peerId);
      if (!entry) return state;

      // Check capacity
      if (Object.keys(state.participants).length >= state.maxParticipants) {
        return state; // Still at capacity
      }

      // Create participant from waiting room entry
      const newParticipant: Participant = {
        peerId: entry.peerId,
        name: entry.name,
        role: entry.role,
        stream: null,
        isMuted: false,
        isCameraOff: false,
        isSpeaking: false,
        isHandRaised: false,
        engagementScore: 50,
        studentState: null,
        eyeContactScore: 0,
        connectionQuality: 'good',
        joinedAt: Date.now(),
      };

      return {
        participants: {
          ...state.participants,
          [peerId]: newParticipant,
        },
        waitingRoom: state.waitingRoom.filter((e) => e.peerId !== peerId),
      };
    }),

  denyFromWaitingRoom: (peerId) =>
    set((state) => ({
      waitingRoom: state.waitingRoom.filter((e) => e.peerId !== peerId),
    })),

  getParticipantList: () => {
    const state = get();
    return Object.values(state.participants).sort((a, b) => {
      // Tutors first, then by join order
      if (a.role !== b.role) {
        return a.role === 'tutor' ? -1 : 1;
      }
      return a.joinedAt - b.joinedAt;
    });
  },

  getActiveSpeaker: () => {
    const state = get();
    const participants = Object.values(state.participants);
    const speakers = participants.filter((p) => p.isSpeaking);
    if (speakers.length === 0) return null;
    // Return highest engagement speaker
    return speakers.reduce((max, p) => (p.engagementScore > max.engagementScore ? p : max));
  },

  getParticipantById: (peerId) => {
    const state = get();
    return state.participants[peerId] || null;
  },

  isFull: () => {
    const state = get();
    return Object.keys(state.participants).length >= state.maxParticipants;
  },

  reset: () =>
    set({
      participants: {},
      localPeerId: '',
      waitingRoom: [],
    }),
}));
