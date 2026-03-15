/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MeshConnection: Manages N-way WebRTC peer connections for multi-participant sessions.
 *
 * Creates and maintains one RTCPeerConnection per remote participant.
 * Implements perfect negotiation pattern with polite/impolite roles.
 * Handles ICE candidates, track management, and connection quality monitoring.
 */

export interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type OnRemoteStream = (peerId: string, stream: MediaStream) => void;
type OnRemoteTrack = (peerId: string, track: MediaStreamTrack, stream: MediaStream) => void;
type OnPeerStateChange = (peerId: string, connected: boolean) => void;
type OnConnectionQuality = (peerId: string, quality: 'excellent' | 'good' | 'poor' | 'reconnecting') => void;
type OnSignal = (message: SignalMessage) => void;

interface PeerConnectionState {
  pc: RTCPeerConnection;
  stream: MediaStream;
  makingOffer: boolean;
  ignoreOffer: boolean;
  remoteStream: MediaStream;
  dataChannel?: RTCDataChannel;
}

export class MeshConnection {
  private connections: Map<string, PeerConnectionState> = new Map();
  private localPeerId: string;
  private localStream: MediaStream | null = null;
  private onRemoteStream: OnRemoteStream;
  private onRemoteTrack: OnRemoteTrack;
  private onPeerStateChange: OnPeerStateChange;
  private onConnectionQuality: OnConnectionQuality;
  private onSignal: OnSignal;
  private statsIntervals: Map<string, number> = new Map();

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  private maxConnections = 7; // Support up to 8 participants (including self)

  constructor(
    localPeerId: string,
    onRemoteStream: OnRemoteStream,
    onRemoteTrack: OnRemoteTrack,
    onPeerStateChange: OnPeerStateChange,
    onConnectionQuality: OnConnectionQuality,
    onSignal: OnSignal,
    iceServers?: RTCIceServer[]
  ) {
    this.localPeerId = localPeerId;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteTrack = onRemoteTrack;
    this.onPeerStateChange = onPeerStateChange;
    this.onConnectionQuality = onConnectionQuality;
    this.onSignal = onSignal;

    if (iceServers) {
      this.iceServers = iceServers;
    }
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
  }

  /**
   * Add a new peer connection. The "polite" peer (with smaller peerId) handles renegotiation.
   */
  async addPeer(peerId: string) {
    if (this.connections.has(peerId)) {
      console.warn(`Peer ${peerId} already exists`);
      return;
    }

    if (this.connections.size >= this.maxConnections) {
      console.error(`Max connections (${this.maxConnections}) reached`);
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    const remoteStream = new MediaStream();
    const state: PeerConnectionState = {
      pc,
      stream: remoteStream,
      makingOffer: false,
      ignoreOffer: false,
      remoteStream,
    };

    this.connections.set(peerId, state);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      const { track, streams } = event;

      if (streams && streams.length > 0) {
        remoteStream.addTrack(track);
      } else {
        remoteStream.addTrack(track);
      }

      this.onRemoteTrack(peerId, track, remoteStream);
      this.onRemoteStream(peerId, remoteStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onSignal({
          type: 'ice-candidate',
          from: this.localPeerId,
          to: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const connected = pc.connectionState === 'connected';
      this.onPeerStateChange(peerId, connected);
      this.updateConnectionQuality(peerId);
    };

    // Handle signaling state changes
    pc.onsignalingstatechange = () => {
      const state = this.connections.get(peerId);
      if (state) {
        state.ignoreOffer = false;
      }
    };

    // Create data channel for chat/reactions
    const dataChannel = pc.createDataChannel('messaging', { ordered: true });
    this.setupDataChannel(dataChannel);
    state.dataChannel = dataChannel;

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    // Handle negotiation needed
    pc.onnegotiationneeded = async () => {
      try {
        const state = this.connections.get(peerId);
        if (!state) return;

        const isPolite = this.localPeerId < peerId; // Lexicographic comparison
        const hasOfferingPeer = pc.signalingState !== 'stable';

        if (!isPolite && hasOfferingPeer) {
          state.ignoreOffer = true;
          return;
        }

        state.makingOffer = true;
        await pc.setLocalDescription();

        this.onSignal({
          type: 'offer',
          from: this.localPeerId,
          to: peerId,
          sdp: pc.localDescription!.toJSON(),
        });
      } catch (err) {
        console.error(`Negotiation error with ${peerId}:`, err);
      } finally {
        const state = this.connections.get(peerId);
        if (state) {
          state.makingOffer = false;
        }
      }
    };

    // Start monitoring connection quality
    this.monitorConnectionQuality(peerId);
  }

  /**
   * Remove and close a peer connection.
   */
  removePeer(peerId: string) {
    const state = this.connections.get(peerId);
    if (!state) return;

    // Stop monitoring
    const interval = this.statsIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.statsIntervals.delete(peerId);
    }

    // Close data channel
    if (state.dataChannel) {
      state.dataChannel.close();
    }

    // Close peer connection
    state.pc.close();
    this.connections.delete(peerId);

    this.onPeerStateChange(peerId, false);
  }

  /**
   * Handle incoming signaling message.
   */
  async handleSignal(message: SignalMessage) {
    if (message.from === this.localPeerId) return;

    const peerId = message.from;
    let state = this.connections.get(peerId);

    // Create peer if it doesn't exist
    if (!state) {
      await this.addPeer(peerId);
      state = this.connections.get(peerId);
      if (!state) return;
    }

    const pc = state.pc;

    try {
      if (message.type === 'offer') {
        if (state.ignoreOffer) {
          return;
        }

        const isPolite = this.localPeerId < peerId;
        const shouldProcess = isPolite || pc.signalingState === 'stable';

        if (!shouldProcess) {
          state.ignoreOffer = true;
          return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(message.sdp!));

        if (pc.signalingState === 'have-remote-offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.onSignal({
            type: 'answer',
            from: this.localPeerId,
            to: peerId,
            sdp: pc.localDescription!.toJSON(),
          });
        }
      } else if (message.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(message.sdp!));
        }
      } else if (message.type === 'ice-candidate') {
        if (message.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
          } catch (err) {
            if (!state.ignoreOffer) {
              console.error(`ICE error with ${peerId}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Signaling error with ${peerId}:`, err);
    }
  }

  /**
   * Get connection statistics for quality assessment.
   */
  async getStats(peerId: string) {
    const state = this.connections.get(peerId);
    if (!state) return null;

    try {
      const report = await state.pc.getStats();
      const stats: Record<string, unknown> = {};

      report.forEach((stat) => {
        if (stat.type === 'inbound-rtp') {
          stats.bytesReceived = (stat as any).bytesReceived;
          stats.packetsReceived = (stat as any).packetsLost;
          stats.jitter = (stat as any).jitter;
        } else if (stat.type === 'outbound-rtp') {
          stats.bytesSent = (stat as any).bytesSent;
          stats.packetsSent = (stat as any).packetsSent;
          stats.framesEncoded = (stat as any).framesEncoded;
        } else if (stat.type === 'candidate-pair' && (stat as any).state === 'succeeded') {
          stats.currentRoundTripTime = (stat as any).currentRoundTripTime;
          stats.availableOutgoingBitrate = (stat as any).availableOutgoingBitrate;
        }
      });

      return stats;
    } catch (err) {
      console.error(`Stats retrieval error for ${peerId}:`, err);
      return null;
    }
  }

  /**
   * Monitor connection quality and update metrics.
   */
  private monitorConnectionQuality(peerId: string) {
    const interval = window.setInterval(async () => {
      const stats = await this.getStats(peerId);
      if (!stats) return;

      const rtt = (stats.currentRoundTripTime as number) || 0;
      let quality: 'excellent' | 'good' | 'poor' | 'reconnecting';

      if (rtt < 50) {
        quality = 'excellent';
      } else if (rtt < 150) {
        quality = 'good';
      } else {
        quality = 'poor';
      }

      this.onConnectionQuality(peerId, quality);
    }, 1000);

    this.statsIntervals.set(peerId, interval);
  }

  /**
   * Update connection quality based on current state.
   */
  private updateConnectionQuality(peerId: string) {
    const state = this.connections.get(peerId);
    if (!state) return;

    const pc = state.pc;
    let quality: 'excellent' | 'good' | 'poor' | 'reconnecting';

    if (pc.connectionState === 'connected') {
      quality = 'good';
    } else if (pc.connectionState === 'disconnected') {
      quality = 'poor';
    } else if (pc.connectionState === 'failed') {
      quality = 'reconnecting';
    } else {
      quality = 'good';
    }

    this.onConnectionQuality(peerId, quality);
  }

  /**
   * Setup data channel for messaging.
   */
  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      console.log('Data channel opened:', channel.label);
    };

    channel.onclose = () => {
      console.log('Data channel closed:', channel.label);
    };

    channel.onerror = (event) => {
      console.error('Data channel error:', event);
    };
  }

  /**
   * Send message through data channel.
   */
  sendMessage(peerId: string, message: unknown) {
    const state = this.connections.get(peerId);
    if (!state || !state.dataChannel || state.dataChannel.readyState !== 'open') {
      console.warn(`Cannot send message to ${peerId}: channel not ready`);
      return;
    }

    try {
      state.dataChannel.send(JSON.stringify(message));
    } catch (err) {
      console.error(`Failed to send message to ${peerId}:`, err);
    }
  }

  /**
   * Broadcast message to all peers.
   */
  broadcast(message: unknown) {
    this.connections.forEach((_, peerId) => {
      this.sendMessage(peerId, message);
    });
  }

  /**
   * Get all connected peer IDs.
   */
  getPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get connection state for a peer.
   */
  getConnectionState(peerId: string): string | null {
    const state = this.connections.get(peerId);
    return state ? state.pc.connectionState : null;
  }

  /**
   * Close all connections and cleanup.
   */
  close() {
    this.connections.forEach((_, peerId) => {
      this.removePeer(peerId);
    });
    this.connections.clear();
    this.statsIntervals.forEach((interval) => clearInterval(interval));
    this.statsIntervals.clear();
  }
}
