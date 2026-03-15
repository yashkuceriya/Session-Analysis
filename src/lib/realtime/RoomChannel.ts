/**
 * RoomChannel: BroadcastChannel-based real-time sync between tutor and student tabs.
 *
 * Both participants open /session?room=<room-id>&role=tutor|student
 * Metrics from each participant are broadcast to the other via BroadcastChannel.
 * Works same-origin (same browser, different tabs) without any server.
 *
 * For cross-device: extend with WebSocket or WebRTC signaling.
 */

export interface PeerMetrics {
  eyeContactScore: number;
  isSpeaking: boolean;
  energyScore: number;
  audioEnergy: number;
  timestamp: number;
}

export interface RoomMessage {
  type: 'join' | 'leave' | 'metrics' | 'ping' | 'pong';
  role: 'tutor' | 'student';
  roomId: string;
  data?: PeerMetrics;
}

type MessageHandler = (msg: RoomMessage) => void;

export class RoomChannel {
  private channel: BroadcastChannel;
  private role: 'tutor' | 'student';
  private roomId: string;
  private handlers: MessageHandler[] = [];
  private pingInterval: number | null = null;

  constructor(roomId: string, role: 'tutor' | 'student') {
    this.roomId = roomId;
    this.role = role;
    this.channel = new BroadcastChannel(`nerdy-room-${roomId}`);

    this.channel.onmessage = (event: MessageEvent<RoomMessage>) => {
      const msg = event.data;
      if (msg.role === this.role) return; // Ignore own messages
      if (msg.roomId !== this.roomId) return;
      this.handlers.forEach((h) => h(msg));
    };
  }

  join() {
    this.send({ type: 'join', role: this.role, roomId: this.roomId });
    // Heartbeat every 3s so peer knows we're alive
    this.pingInterval = window.setInterval(() => {
      this.send({ type: 'ping', role: this.role, roomId: this.roomId });
    }, 3000);
  }

  leave() {
    this.send({ type: 'leave', role: this.role, roomId: this.roomId });
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.channel.close();
  }

  broadcastMetrics(data: PeerMetrics) {
    this.send({ type: 'metrics', role: this.role, roomId: this.roomId, data });
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private send(msg: RoomMessage) {
    try {
      this.channel.postMessage(msg);
    } catch {
      // Channel closed
    }
  }

  getRole() {
    return this.role;
  }

  getRoomId() {
    return this.roomId;
  }
}
