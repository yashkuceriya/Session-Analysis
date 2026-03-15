/**
 * WebRTC peer connection with BroadcastChannel signaling.
 *
 * Enables real video/audio streaming between tutor and student tabs.
 * No server needed for same-origin (same browser). For cross-device,
 * replace BroadcastChannel with WebSocket signaling.
 */

export type PeerRole = 'tutor' | 'student';

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'ready';
  from: PeerRole;
  roomId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type OnRemoteStream = (stream: MediaStream) => void;
type OnPeerState = (connected: boolean) => void;

export class PeerConnection {
  private pc: RTCPeerConnection | null = null;
  private channel: BroadcastChannel;
  private role: PeerRole;
  private roomId: string;
  private localStream: MediaStream | null = null;
  private onRemoteStream: OnRemoteStream;
  private onPeerState: OnPeerState;
  private makingOffer = false;

  constructor(
    roomId: string,
    role: PeerRole,
    onRemoteStream: OnRemoteStream,
    onPeerState: OnPeerState
  ) {
    this.roomId = roomId;
    this.role = role;
    this.onRemoteStream = onRemoteStream;
    this.onPeerState = onPeerState;
    this.channel = new BroadcastChannel(`nerdy-webrtc-${roomId}`);
    this.channel.onmessage = (e: MessageEvent<SignalingMessage>) => this.handleSignaling(e.data);
  }

  async start(localStream: MediaStream) {
    this.localStream = localStream;
    this.createPeerConnection();

    // Add local tracks
    localStream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, localStream);
    });

    // Announce presence
    this.send({ type: 'join', from: this.role, roomId: this.roomId });

    // Tutor is the "polite" peer (creates offer when student joins)
    // Student is "impolite" (waits for offer)
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Collect remote tracks into a single stream
    const remoteStream = new MediaStream();

    this.pc.ontrack = (event) => {
      event.track.onunmute = () => {
        if (!remoteStream.getTrackById(event.track.id)) {
          remoteStream.addTrack(event.track);
        }
        this.onRemoteStream(remoteStream);
      };
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: 'ice-candidate',
          from: this.role,
          roomId: this.roomId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      this.onPeerState(state === 'connected');
    };

    this.pc.onnegotiationneeded = async () => {
      if (!this.pc) return;
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.send({
          type: 'offer',
          from: this.role,
          roomId: this.roomId,
          sdp: this.pc.localDescription!.toJSON(),
        });
      } catch {
        // Negotiation failed
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private async handleSignaling(msg: SignalingMessage) {
    if (msg.from === this.role) return; // Ignore own messages
    if (msg.roomId !== this.roomId) return;
    if (!this.pc) return;

    try {
      if (msg.type === 'join') {
        this.onPeerState(false); // Peer joined but not yet connected
        // If we're the tutor and student joins, create offer
        if (this.role === 'tutor') {
          const offer = await this.pc.createOffer();
          await this.pc.setLocalDescription(offer);
          this.send({
            type: 'offer',
            from: this.role,
            roomId: this.roomId,
            sdp: this.pc.localDescription!.toJSON(),
          });
        }
      }

      if (msg.type === 'offer' && msg.sdp) {
        const isStable = this.pc.signalingState === 'stable';
        const collision = !isStable || this.makingOffer;
        const isPolite = this.role === 'student'; // student is polite

        if (collision && !isPolite) return;

        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.send({
          type: 'answer',
          from: this.role,
          roomId: this.roomId,
          sdp: this.pc.localDescription!.toJSON(),
        });
      }

      if (msg.type === 'answer' && msg.sdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

      if (msg.type === 'ice-candidate' && msg.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }

      if (msg.type === 'leave') {
        this.onPeerState(false);
      }
    } catch {
      // Signaling error — ignore
    }
  }

  private send(msg: SignalingMessage) {
    try {
      this.channel.postMessage(msg);
    } catch {
      // Channel closed
    }
  }

  stop() {
    this.send({ type: 'leave', from: this.role, roomId: this.roomId });
    this.pc?.close();
    this.pc = null;
    this.channel.close();
  }
}
