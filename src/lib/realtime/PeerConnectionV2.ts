/**
 * Enhanced WebRTC peer connection with support for both BroadcastChannel (local) and WebSocket (cross-device).
 *
 * Features:
 * - TURN server support with configurable ICE servers
 * - WebRTC DataChannel for chat/reactions
 * - Connection quality monitoring via stats polling
 * - Auto-reconnect on connection failure (ICE restart)
 * - Adaptive hooks for video quality management
 * - Comprehensive connection state tracking
 */

import { SignalingClient, SignalingMessage, PeerRole } from './SignalingClient';

export interface DataMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ConnectionStats {
  rtt: number; // Round trip time in ms
  packetLoss: number; // Percentage 0-100
  bandwidth: number; // Kilobits per second
  quality: 'excellent' | 'good' | 'poor';
  audioLevel?: number;
}

export interface PeerConnectionV2Config {
  roomId: string;
  role: PeerRole;
  signalingUrl?: string; // If provided, use WebSocket; otherwise BroadcastChannel
  onRemoteStream: (stream: MediaStream) => void;
  onPeerState: (state: ConnectionState) => void;
  onDataMessage?: (msg: DataMessage) => void;
  iceServers?: RTCIceServer[];
}

export class PeerConnectionV2 {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingClient: SignalingClient;
  private config: PeerConnectionV2Config;
  private localStream: MediaStream | null = null;
  private makingOffer = false;
  private connectionState: ConnectionState = 'disconnected';
  private lastStats: Partial<ConnectionStats> = {};
  private ignoreOffer = false;

  constructor(config: PeerConnectionV2Config) {
    this.config = config;
    this.signalingClient = new SignalingClient(config.roomId, config.role);
  }

  async start(localStream: MediaStream): Promise<void> {
    this.localStream = localStream;
    this.createPeerConnection();

    // Connect to signaling
    await this.signalingClient.connect(this.config.signalingUrl);

    // Add local tracks
    if (this.pc) {
      localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, localStream);
      });
    }

    // Listen to signaling messages
    this.signalingClient.onMessage((msg) => this.handleSignaling(msg));

    // Announce presence
    this.signalingClient.send({
      type: 'join',
      from: this.config.role,
      roomId: this.config.roomId,
    });
  }

  private createPeerConnection(): void {
    // TURN server config from environment (with free-tier defaults)
    const turnUrl = typeof window !== 'undefined'
      ? (window as any).__NEXT_DATA__?.props?.pageProps?.turnUrl
      : undefined;

    const iceServers = this.config.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Metered TURN servers — override via NEXT_PUBLIC_TURN_* env vars
      {
        urls: process.env.NEXT_PUBLIC_TURN_URL || 'turn:a.relay.metered.ca:80',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'e8dd65b92c805a5e0a207542',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '5V2sNnBi2VqGTSgk',
      },
      {
        urls: (process.env.NEXT_PUBLIC_TURN_URL || 'turn:a.relay.metered.ca:80') + '?transport=tcp',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'e8dd65b92c805a5e0a207542',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '5V2sNnBi2VqGTSgk',
      },
      {
        urls: process.env.NEXT_PUBLIC_TURNS_URL || 'turn:a.relay.metered.ca:443',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'e8dd65b92c805a5e0a207542',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '5V2sNnBi2VqGTSgk',
      },
      {
        urls: process.env.NEXT_PUBLIC_TURNS_TLS_URL || 'turns:a.relay.metered.ca:443?transport=tcp',
        username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'e8dd65b92c805a5e0a207542',
        credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '5V2sNnBi2VqGTSgk',
      },
      { urls: 'stun:stun.services.mozilla.com:3478' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
    ];

    this.pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'all',
    });

    const remoteStream = new MediaStream();

    // Initiator creates the data channel; responder receives via ondatachannel
    if (this.config.role === 'tutor') {
      this.dataChannel = this.pc.createDataChannel('chat', { ordered: true });
      this.setupDataChannelListeners();
    }

    this.pc.ontrack = (event) => {
      // Add track immediately
      if (!remoteStream.getTrackById(event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      this.config.onRemoteStream(remoteStream);

      // Also handle unmute for late tracks
      event.track.onunmute = () => {
        if (!remoteStream.getTrackById(event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        this.config.onRemoteStream(remoteStream);
      };
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingClient.send({
          type: 'ice-candidate',
          from: this.config.role,
          roomId: this.config.roomId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onicecandidateerror = (event) => {
      console.warn('[PeerConnectionV2] ICE candidate error:', event.errorCode, event.errorText);
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      const newState = this.mapConnectionState(state || 'disconnected');
      this.setConnectionState(newState);

      if (state === 'failed') {
        this.attemptICERestart();
      }
    };

    this.pc.onicegatheringstatechange = () => {
      console.log('[PeerConnectionV2] ICE gathering state:', this.pc?.iceGatheringState);
    };

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };

    this.pc.onnegotiationneeded = async () => {
      if (!this.pc) return;
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.signalingClient.send({
          type: 'offer',
          from: this.config.role,
          roomId: this.config.roomId,
          sdp: this.pc.localDescription!.toJSON(),
        });
      } catch {
        // Negotiation failed
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private setupDataChannelListeners(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('[PeerConnectionV2] Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as DataMessage;
        this.config.onDataMessage?.(msg);
      } catch {
        // Parse error, ignore
      }
    };

    this.dataChannel.onclose = () => {
      console.log('[PeerConnectionV2] Data channel closed');
    };
  }

  private async handleSignaling(msg: SignalingMessage): Promise<void> {
    if (!this.pc) return;

    try {
      if (msg.type === 'join') {
        this.setConnectionState('connecting');
        // Tutor creates offer when student joins
        if (this.config.role === 'tutor') {
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription(offer);
          this.signalingClient.send({
            type: 'offer',
            from: this.config.role,
            roomId: this.config.roomId,
            sdp: this.pc.localDescription!.toJSON(),
          });
        }
      }

      if (msg.type === 'offer' && msg.sdp) {
        // Implement polite/impolite peer pattern
        const isStable = this.pc.signalingState === 'stable';
        const collision = !isStable || this.makingOffer;
        const isPolite = this.config.role === 'student'; // student is polite

        if (collision && !isPolite) {
          this.ignoreOffer = true;
          return;
        }

        this.ignoreOffer = false;
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

        if (this.pc.signalingState === 'have-remote-offer') {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.signalingClient.send({
            type: 'answer',
            from: this.config.role,
            roomId: this.config.roomId,
            sdp: this.pc.localDescription!.toJSON(),
          });
        }
      }

      if (msg.type === 'answer' && msg.sdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

      if (msg.type === 'ice-candidate' && msg.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }

      if (msg.type === 'leave') {
        this.setConnectionState('disconnected');
      }
    } catch (err) {
      console.error('[PeerConnectionV2] Signaling error:', err);
    }
  }

  private mapConnectionState(state: string): ConnectionState {
    switch (state) {
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'failed':
        return 'reconnecting';
      case 'closed':
        return 'disconnected';
      default:
        return 'disconnected';
    }
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.config.onPeerState(state);
    }
  }

  private attemptICERestart(): void {
    if (!this.pc) return;
    this.setConnectionState('reconnecting');

    setTimeout(() => {
      if (this.pc) {
        this.pc.restartIce();
      }
    }, 1000);
  }

  async getStats(): Promise<ConnectionStats | null> {
    if (!this.pc) return null;

    try {
      const stats = await this.pc.getStats();
      let rtt = 0;
      let packetLoss = 0;
      let audioLevel = 0;
      let bandwidth = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          const bytesReceived = report.bytesReceived as number;
          const packetsReceived = report.packetsReceived as number;
          const packetsLost = report.packetsLost as number;

          if (packetsReceived > 0) {
            packetLoss = (packetsLost / (packetsReceived + packetsLost)) * 100;
          }

          if (report.mediaType === 'audio') {
            audioLevel = Math.sqrt((report.audioLevel as number) || 0) * 100;
          }

          // Estimate bandwidth (bytes/sec -> kb/s)
          if (report.timestamp) {
            const bytesPerSecond = bytesReceived / ((report.timestamp as number) / 1000);
            bandwidth = (bytesPerSecond * 8) / 1024;
          }
        }

        if (report.type === 'candidate-pair' && (report.state as string) === 'succeeded') {
          rtt = (report.currentRoundTripTime as number) * 1000; // Convert to ms
        }
      });

      const quality = this.computeQuality(rtt, packetLoss);

      return {
        rtt: Math.round(rtt),
        packetLoss: Math.round(packetLoss * 100) / 100,
        bandwidth: Math.round(bandwidth),
        quality,
        audioLevel: Math.round(audioLevel),
      };
    } catch {
      return null;
    }
  }

  private computeQuality(rtt: number, packetLoss: number): 'excellent' | 'good' | 'poor' {
    // Excellent: low latency, no loss
    if (rtt < 100 && packetLoss < 1) {
      return 'excellent';
    }
    // Good: moderate latency, some loss acceptable
    if (rtt < 300 && packetLoss < 5) {
      return 'good';
    }
    // Poor: high latency or significant loss
    return 'poor';
  }

  sendData(msg: DataMessage): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('[PeerConnectionV2] Data channel not ready');
      return;
    }

    // Backpressure: don't send if buffer is too full (16KB threshold)
    if (this.dataChannel.bufferedAmount > 16384) {
      console.warn('[PeerConnectionV2] Data channel buffer full, dropping message');
      return;
    }

    try {
      this.dataChannel.send(JSON.stringify(msg));
    } catch (err) {
      console.error('[PeerConnectionV2] Failed to send data:', err);
    }
  }

  /** Replace a track (e.g., swap camera for screen share) */
  async replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack): Promise<void> {
    if (!this.pc) return;
    const sender = this.pc.getSenders().find(s => s.track?.kind === oldTrack.kind);
    if (sender) {
      await sender.replaceTrack(newTrack);
    }
  }

  /** Get all senders for track replacement */
  getSenders(): RTCRtpSender[] {
    return this.pc?.getSenders() || [];
  }

  stop(): void {
    this.signalingClient.send({
      type: 'leave',
      from: this.config.role,
      roomId: this.config.roomId,
    });

    this.dataChannel?.close();
    this.pc?.close();
    this.pc = null;

    this.signalingClient.disconnect();
    this.setConnectionState('disconnected');
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getLastStats(): Partial<ConnectionStats> {
    return this.lastStats;
  }

  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }
}
