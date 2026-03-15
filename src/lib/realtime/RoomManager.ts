/**
 * RoomManager: In-memory room lifecycle and participant management.
 *
 * Manages room creation, joining, leaving, and state transitions.
 * Emits events for participant changes.
 * Generates 6-character invite codes for rooms.
 */

import { Participant } from '@/stores/participantStore';

export type RoomState = 'waiting' | 'active' | 'ended';

export interface RoomConfig {
  maxParticipants?: number;
  recordingEnabled?: boolean;
  screenShareEnabled?: boolean;
  chatEnabled?: boolean;
  subject?: string;
  sessionType?: 'lecture' | 'practice' | 'discussion';
}

export interface RoomInfo {
  roomId: string;
  inviteCode: string;
  tutorId: string;
  createdAt: number;
  state: RoomState;
  participants: Participant[];
  config: RoomConfig;
  participantCount: number;
}

interface RoomData {
  roomId: string;
  inviteCode: string;
  tutorId: string;
  createdAt: number;
  state: RoomState;
  participants: Map<string, Participant>;
  config: RoomConfig;
}

export type RoomEventType = 'participant-joined' | 'participant-left' | 'room-full' | 'room-ended';

type RoomEventHandler = (event: {
  type: RoomEventType;
  roomId: string;
  data?: unknown;
}) => void;

export class RoomManager {
  private rooms: Map<string, RoomData> = new Map();
  private inviteCodeMap: Map<string, string> = new Map(); // inviteCode -> roomId
  private eventHandlers: RoomEventHandler[] = [];

  /**
   * Generate a 6-character random invite code.
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Generate unique room ID (timestamp-based for simplicity).
   */
  private generateRoomId(): string {
    return `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new room.
   */
  createRoom(tutorId: string, config: RoomConfig = {}): RoomInfo {
    const roomId = this.generateRoomId();
    const inviteCode = this.generateInviteCode();

    const roomData: RoomData = {
      roomId,
      inviteCode,
      tutorId,
      createdAt: Date.now(),
      state: 'waiting',
      participants: new Map(),
      config: {
        maxParticipants: 8,
        recordingEnabled: false,
        screenShareEnabled: true,
        chatEnabled: true,
        ...config,
      },
    };

    this.rooms.set(roomId, roomData);
    this.inviteCodeMap.set(inviteCode, roomId);

    return this.getRoomInfo(roomId)!;
  }

  /**
   * Join a room by room ID.
   */
  joinRoom(roomId: string, participant: Participant): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.error(`Room ${roomId} not found`);
      return false;
    }

    if (room.state === 'ended') {
      console.error(`Room ${roomId} has ended`);
      return false;
    }

    if (room.participants.size >= room.config.maxParticipants!) {
      this.emitEvent({
        type: 'room-full',
        roomId,
        data: { maxParticipants: room.config.maxParticipants },
      });
      return false;
    }

    room.participants.set(participant.peerId, participant);

    // Transition to active if tutor is present
    if (
      room.state === 'waiting' &&
      Array.from(room.participants.values()).some((p) => p.role === 'tutor')
    ) {
      room.state = 'active';
    }

    this.emitEvent({
      type: 'participant-joined',
      roomId,
      data: {
        participant: participant,
        participantCount: room.participants.size,
      },
    });

    return true;
  }

  /**
   * Join a room by invite code.
   */
  joinRoomByCode(inviteCode: string, participant: Participant): string | null {
    const roomId = this.inviteCodeMap.get(inviteCode);
    if (!roomId) {
      console.error(`Invalid invite code: ${inviteCode}`);
      return null;
    }

    const success = this.joinRoom(roomId, participant);
    return success ? roomId : null;
  }

  /**
   * Leave a room.
   */
  leaveRoom(roomId: string, peerId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.error(`Room ${roomId} not found`);
      return false;
    }

    if (!room.participants.has(peerId)) {
      return false;
    }

    room.participants.delete(peerId);

    this.emitEvent({
      type: 'participant-left',
      roomId,
      data: {
        peerId,
        participantCount: room.participants.size,
      },
    });

    // End room if tutor leaves or room is empty
    if (
      room.participants.size === 0 ||
      !Array.from(room.participants.values()).some((p) => p.role === 'tutor')
    ) {
      room.state = 'ended';
      this.emitEvent({
        type: 'room-ended',
        roomId,
        data: { reason: 'tutor-left' },
      });
    }

    return true;
  }

  /**
   * Get room information.
   */
  getRoomInfo(roomId: string): RoomInfo | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      roomId: room.roomId,
      inviteCode: room.inviteCode,
      tutorId: room.tutorId,
      createdAt: room.createdAt,
      state: room.state,
      participants: Array.from(room.participants.values()),
      config: room.config,
      participantCount: room.participants.size,
    };
  }

  /**
   * Get room by invite code.
   */
  getRoomByCode(inviteCode: string): RoomInfo | null {
    const roomId = this.inviteCodeMap.get(inviteCode);
    return roomId ? this.getRoomInfo(roomId) : null;
  }

  /**
   * Update participant in a room.
   */
  updateParticipant(roomId: string, peerId: string, updates: Partial<Participant>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const participant = room.participants.get(peerId);
    if (!participant) return false;

    const updated = { ...participant, ...updates };
    room.participants.set(peerId, updated);
    return true;
  }

  /**
   * Get participant from room.
   */
  getParticipant(roomId: string, peerId: string): Participant | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.participants.get(peerId) || null;
  }

  /**
   * Check if room exists.
   */
  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Get all rooms for a tutor.
   */
  getTutorRooms(tutorId: string): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    this.rooms.forEach((room) => {
      if (room.tutorId === tutorId) {
        const info = this.getRoomInfo(room.roomId);
        if (info) rooms.push(info);
      }
    });
    return rooms;
  }

  /**
   * End a room.
   */
  endRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.state = 'ended';
    room.participants.clear();

    this.emitEvent({
      type: 'room-ended',
      roomId,
      data: { reason: 'explicit' },
    });

    return true;
  }

  /**
   * Register event handler.
   */
  onEvent(handler: RoomEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  /**
   * Emit event to all handlers.
   */
  private emitEvent(event: { type: RoomEventType; roomId: string; data?: unknown }) {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (err) {
        console.error('Error in room event handler:', err);
      }
    });
  }

  /**
   * Clean up old rooms (those ended > 1 hour ago).
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const toDelete: string[] = [];
    this.rooms.forEach((room, roomId) => {
      if (room.state === 'ended' && room.createdAt < oneHourAgo) {
        toDelete.push(roomId);
      }
    });

    toDelete.forEach((roomId) => {
      const room = this.rooms.get(roomId);
      if (room) {
        this.inviteCodeMap.delete(room.inviteCode);
        this.rooms.delete(roomId);
      }
    });
  }

  /**
   * Get all active rooms.
   */
  getActiveRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    this.rooms.forEach((room) => {
      if (room.state !== 'ended') {
        const info = this.getRoomInfo(room.roomId);
        if (info) rooms.push(info);
      }
    });
    return rooms;
  }
}

// Singleton instance
export const roomManager = new RoomManager();
