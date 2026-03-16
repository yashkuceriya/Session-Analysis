/**
 * Hybrid signaling client for cross-device WebRTC communication.
 *
 * Supports three modes:
 * 1. WebSocket: Full duplex communication (requires server)
 * 2. BroadcastChannel + HTTP polling: Dual-mode for both same-browser and cross-device
 *    - BroadcastChannel for same-browser (low latency)
 *    - HTTP polling for cross-device (compatible with stateless deployments)
 * 3. BroadcastChannel only: Legacy mode for same-browser only
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Room-scoped messaging
 * - Heartbeat/ping to keep connection alive
 * - Message deduplication across channels
 * - Connection state tracking
 * - Message queuing while reconnecting
 * - Adaptive polling (500ms during negotiation, 2s once connected)
 */

export type PeerRole = 'tutor' | 'student';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'ready';
  from: PeerRole;
  roomId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface InternalSignalMessage extends SignalingMessage {
  id?: string;
  timestamp?: number;
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
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private pollingInterval: ReturnType<typeof setTimeout> | null = null;
  private isUsingWebSocket: boolean = false;
  private isUsingHttpPolling: boolean = false;
  private connected: boolean = false;
  private wsUrl: string | null = null;
  private lastPollTime = 0;
  private seenMessageIds = new Set<string>();
  private broadcastChannelReady = false;
  private httpPollingReady = false;

  constructor(roomId: string, role: PeerRole) {
    this.roomId = roomId;
    this.role = role;
  }

  async connect(url?: string): Promise<void> {
    if (url) {
      // WebSocket mode (full duplex, requires server)
      this.isUsingWebSocket = true;
      return this.connectWebSocket(url);
    }

    // Dual mode: BroadcastChannel + HTTP polling
    // BroadcastChannel handles same-browser, HTTP polling handles cross-device
    // Both run simultaneously for maximum compatibility
    this.initBroadcastChannel();
    this.initHttpPolling();
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
    try {
      this.broadcastChannel = new BroadcastChannel(`nerdy-signaling-${this.roomId}`);

      this.broadcastChannel.onmessage = (event: MessageEvent<InternalSignalMessage>) => {
        const msg = event.data;
        if (msg.from !== this.role && msg.roomId === this.roomId) {
          // Deduplicate using message ID if available
          if (msg.id && this.seenMessageIds.has(msg.id)) {
            return; // Duplicate, ignore
          }
          if (msg.id) {
            this.seenMessageIds.add(msg.id);
          }
          this.messageHandlers.forEach((h) => h(msg));
        }
      };

      this.broadcastChannelReady = true;
      this.updateConnectionState();
    } catch (err) {
      console.warn('[SignalingClient] BroadcastChannel not available:', err);
      this.broadcastChannelReady = false;
      this.updateConnectionState();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
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

    this.reconnectTimeoutId = setTimeout(() => {
      if (this.wsUrl) {
        this.connectWebSocket(this.wsUrl).catch(() => {
          // Reconnect failed, will retry via onclose
        });
      }
    }, delay);
  }

  private initHttpPolling(): void {
    if (typeof fetch === 'undefined') return; // Not in browser
    this.isUsingHttpPolling = true;
    this.lastPollTime = Date.now();
    this.httpPollingReady = true;
    this.updateConnectionState();

    // Send initial join message
    this.sendViaHttp({
      type: 'join',
      from: this.role,
      roomId: this.roomId,
    });

    // Send ready signal after a short delay
    setTimeout(() => {
      this.sendViaHttp({
        type: 'ready',
        from: this.role,
        roomId: this.roomId,
      });
    }, 500);

    // Start polling loop
    this.pollSignals();
  }

  private async sendViaHttp(msg: SignalingMessage): Promise<void> {
    try {
      const response = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      });

      if (!response.ok) {
        console.warn('[SignalingClient] HTTP POST failed:', response.status);
      }
    } catch (err) {
      console.warn('[SignalingClient] HTTP POST error:', err);
      // For non-WebSocket mode, we silently fail and retry on next poll
    }
  }

  private async pollSignals(): Promise<void> {
    if (!this.isUsingHttpPolling) {
      return; // Polling disabled
    }

    try {
      const response = await fetch(
        `/api/signal?room=${encodeURIComponent(this.roomId)}&role=${encodeURIComponent(this.role)}&since=${this.lastPollTime}`,
        { method: 'GET' }
      );

      if (response.ok) {
        const data = await response.json();
        this.lastPollTime = data.serverTime || Date.now();

        // Process new messages
        if (data.messages && Array.isArray(data.messages)) {
          for (const msg of data.messages) {
            // Deduplicate
            if (msg.id && this.seenMessageIds.has(msg.id)) {
              continue; // Skip duplicates
            }
            if (msg.id) {
              this.seenMessageIds.add(msg.id);
            }

            // Validate and deliver
            if (msg.from !== this.role && msg.roomId === this.roomId) {
              this.messageHandlers.forEach((h) => h(msg));
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SignalingClient] HTTP GET error:', err);
    } finally {
      // Adaptive polling interval: 500ms during active negotiation, 2s once stable
      const interval = this.connectionState === 'connected' ? 2000 : 500;
      this.pollingInterval = setTimeout(() => {
        this.pollSignals();
      }, interval);
    }
  }

  private updateConnectionState(): void {
    // Consider connected if either channel is ready
    const wasConnected = this.connected;
    this.connected = this.broadcastChannelReady || this.httpPollingReady;

    if (wasConnected !== this.connected) {
      this.notifyConnectionChange(this.connected);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg);
      }
    }
  }

  private get connectionState(): 'connecting' | 'connected' {
    // Simplified state for polling interval logic
    return this.connected ? 'connected' : 'connecting';
  }

  send(msg: SignalingMessage): void {
    if (this.isUsingWebSocket) {
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
      return;
    }

    // Hybrid mode: BroadcastChannel + HTTP polling
    // Try BroadcastChannel first (same-browser)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch {
        // Channel closed, fall through to HTTP
      }
    }

    // Also send via HTTP for cross-device compatibility
    if (this.isUsingHttpPolling) {
      this.sendViaHttp(msg);
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
    this.stopPolling();

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

    this.isUsingHttpPolling = false;
    this.broadcastChannelReady = false;
    this.httpPollingReady = false;
    this.connected = false;
    this.notifyConnectionChange(false);
  }

  private stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
