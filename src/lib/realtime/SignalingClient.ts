/**
 * WebSocket-based signaling client for cross-device WebRTC communication.
 *
 * Replaces BroadcastChannel for scenarios where peers are on different devices.
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Room-scoped messaging
 * - Heartbeat/ping to keep connection alive
 * - Fallback to BroadcastChannel if no WebSocket URL provided (same-browser dev)
 * - Connection state tracking
 * - Message queuing while reconnecting
 */

export type PeerRole = 'tutor' | 'student';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'ready';
  from: PeerRole;
  roomId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type MessageHandler = (msg: SignalingMessage) => void;
type ConnectionChangeHandler = (connected: boolean) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private roomId: string;
  private role: PeerRole;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: MessageHandler[] = [];
  private connectionChangeHandlers: ConnectionChangeHandler[] = [];
  private messageQueue: SignalingMessage[] = [];
  private heartbeatInterval: number | null = null;
  private reconnectTimeoutId: number | null = null;
  private isUsingWebSocket: boolean = false;
  private connected: boolean = false;
  private wsUrl: string | null = null;

  constructor(roomId: string, role: PeerRole) {
    this.roomId = roomId;
    this.role = role;
  }

  async connect(url?: string): Promise<void> {
    if (!url) {
      // Fallback to BroadcastChannel for same-browser dev
      this.initBroadcastChannel();
      return;
    }

    this.isUsingWebSocket = true;
    return this.connectWebSocket(url);
  }

  private async connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsUrl = url;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.connected = true;
          this.notifyConnectionChange(true);

          // Send join message
          this.send({
            type: 'join',
            from: this.role,
            roomId: this.roomId,
          });

          // Start heartbeat
          this.startHeartbeat();

          // Flush queued messages
          this.flushMessageQueue();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as SignalingMessage;
            if (msg.from !== this.role && msg.roomId === this.roomId) {
              this.messageHandlers.forEach((h) => h(msg));
            }
          } catch {
            // JSON parse error, ignore
          }
        };

        this.ws.onerror = () => {
          this.connected = false;
          this.notifyConnectionChange(false);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.notifyConnectionChange(false);
          this.stopHeartbeat();
          if (this.isUsingWebSocket) {
            this.attemptReconnect();
          }
        };
      } catch (err) {
        this.connected = false;
        this.notifyConnectionChange(false);
        reject(err);
      }
    });
  }

  private initBroadcastChannel(): void {
    this.broadcastChannel = new BroadcastChannel(`nerdy-signaling-${this.roomId}`);

    this.broadcastChannel.onmessage = (event: MessageEvent<SignalingMessage>) => {
      const msg = event.data;
      if (msg.from !== this.role && msg.roomId === this.roomId) {
        this.messageHandlers.forEach((h) => h(msg));
      }
    };

    this.connected = true;
    this.notifyConnectionChange(true);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', from: this.role, roomId: this.roomId }));
        } catch {
          // Ignore send errors
        }
      }
    }, 10000); // 10 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[SignalingClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = window.setTimeout(() => {
      if (this.wsUrl) {
        this.connectWebSocket(this.wsUrl).catch(() => {
          // Reconnect failed, will retry via onclose
        });
      }
    }, delay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg);
      }
    }
  }

  send(msg: SignalingMessage): void {
    if (!this.isUsingWebSocket) {
      // BroadcastChannel mode
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage(msg);
        } catch {
          // Channel closed
        }
      }
      return;
    }

    // WebSocket mode
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // Send failed, queue the message
        this.messageQueue.push(msg);
      }
    } else {
      // Not connected, queue the message
      this.messageQueue.push(msg);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: ConnectionChangeHandler): void {
    this.connectionChangeHandlers.push(handler);
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionChangeHandlers.forEach((h) => h(connected));
  }

  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    this.connected = false;
    this.notifyConnectionChange(false);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
