import { Socket } from 'socket.io-client';

export class WebRTCService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private roomId: string;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private remoteUserDisplayNames: Map<string, string> = new Map();
  
  constructor(socket: Socket, roomId: string, onRemoteStream?: (userId: string, stream: MediaStream) => void) {
    this.socket = socket;
    this.roomId = roomId;
    this.localStream = null;
    if (onRemoteStream) {
      this.onRemoteStream = onRemoteStream;
    }
    this.setupSocketListeners();
  }

  public getLocalUserId(): string | undefined {
    return this.socket.id;
  }

  private setupSocketListeners() {
    this.socket.on('ice-candidate', async (data) => {
      console.log('Socket event: ice-candidate', data);
      const { userId, candidate } = data;
      const pc = this.peerConnections.get(userId);
      if (pc) {
        console.log('Adding ICE candidate from user:', userId);
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`ICE candidate added for user: ${userId}`);
        } catch (error) {
          console.error(`Error adding ICE candidate for user ${userId}:`, error);
        }
      } else {
        console.warn('No peer connection found for ICE candidate from user:', userId);
      }
    });

    this.socket.on('offer', async (data) => {
      console.log('Socket event: offer', data);
      const { userId, offer } = data;
      let pc = this.peerConnections.get(userId);
      if (!pc) {
        console.log('Creating peer connection for offer from user:', userId);
        pc = await this.createPeerConnection(userId);
      }
      try {
        console.log(`Setting remote description for offer from user: ${userId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log(`Sending answer to user: ${userId}`);
        this.socket.emit('answer', { userId, answer });
      } catch (error) {
        console.error(`Error handling offer from user ${userId}:`, error);
      }
    });

    this.socket.on('answer', async (data) => {
      console.log('Socket event: answer', data);
      const { userId, answer } = data;
      const pc = this.peerConnections.get(userId);
      if (pc) {
        if (pc.signalingState !== 'stable') {
          try {
            console.log(`Setting remote description for answer from user: ${userId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`Remote description set for answer from user: ${userId}`);
          } catch (error) {
            console.error('Error setting remote description for answer:', error);
          }
        } else {
          console.warn('Ignoring setRemoteDescription for answer due to stable signaling state');
        }
      } else {
        console.warn('No peer connection found for answer from user:', userId);
      }
    });

    this.socket.on('user-joined', async (data) => {
      console.log('Socket event: user-joined', data);
      const { userId, displayName } = data;
      if (userId === this.socket.id) {
        console.log('Ignoring user-joined event for self:', userId);
        return;
      }
      if (displayName) {
        this.remoteUserDisplayNames.set(userId, displayName);
        console.log(`User joined: ${displayName} (${userId})`);
      } else {
        console.log(`User joined with no displayName: ${userId}`);
      }
      await this.createOfferIfNeeded(userId);
    });

    this.socket.on('room-users', async (data) => {
      console.log('Socket event: room-users', data);
      const { users } = data;
      for (const { userId, displayName } of users) {
        if (userId === this.socket.id) {
          console.log('Skipping self in room-users:', userId);
          continue;
        }
        if (displayName) {
          this.remoteUserDisplayNames.set(userId, displayName);
          console.log(`Room user: ${displayName} (${userId})`);
        } else {
          console.log(`Room user with no displayName: ${userId}`);
        }
        await this.createOfferIfNeeded(userId);
      }
    });

    // ... rest of the existing socket event handlers unchanged ...
  }

  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(userId)) {
      console.log(`PeerConnection already exists for user: ${userId}`);
      return this.peerConnections.get(userId)!;
    }

    console.log(`Creating new PeerConnection for user: ${userId}`);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`Sending ICE candidate to user: ${userId}`, event.candidate);
        this.socket.emit('ice-candidate', {
          userId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log(`Received track event from user: ${userId}`, event.streams);
      this.handleTrackEvent(userId, event);
    };

    // Wait for localStream if not available yet
    if (!this.localStream) {
      console.log('Local stream not available yet, waiting...');
      await new Promise<void>((resolve) => {
        const checkStream = () => {
          if (this.localStream) {
            resolve();
          } else {
            setTimeout(checkStream, 100);
          }
        };
        checkStream();
      });
    }

    if (this.localStream) {
      console.log(`Adding local tracks to PeerConnection for user: ${userId}`);
      // Add audio track first, then video track to maintain consistent order
      const audioTracks = this.localStream.getAudioTracks();
      const videoTracks = this.localStream.getVideoTracks();
      audioTracks.forEach((track) => {
        console.log(`Adding audio track`);
        pc.addTrack(track, this.localStream!);
      });
      videoTracks.forEach((track) => {
        console.log(`Adding video track`);
        pc.addTrack(track, this.localStream!);
      });
    } else {
      console.warn('Local stream is still null after waiting when creating PeerConnection');
    }

    this.peerConnections.set(userId, pc);
    return pc;
  }

  private async createOfferIfNeeded(userId: string) {
    if (!this.peerConnections.has(userId)) {
      const pc = await this.createPeerConnection(userId);
      if (pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('createOfferIfNeeded: Sending offer to user:', userId);
        this.socket.emit('offer', { userId, offer });
      }
    } else {
      console.log(`Offer not sent: PeerConnection already exists for user: ${userId}`);
    }
  }

  

  private removePeerConnection(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
  }

  private handleTrackEvent(userId: string, event: RTCTrackEvent) {
    const stream = event.streams[0];
    if (this.onRemoteStream) {
      this.onRemoteStream(userId, stream);
    }
  }

  public async joinRoom(displayName?: string) {
    try {
      // Explicitly request camera and microphone permissions
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (permissions.state === 'denied') {
        console.error('Camera permission denied');
        throw new Error('Camera permission denied');
      }
      const micPermissions = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (micPermissions.state === 'denied') {
        console.error('Microphone permission denied');
        throw new Error('Microphone permission denied');
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      this.socket.emit('join-room', { roomId: this.roomId, displayName });
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  public async toggleAudio(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public async toggleVideo(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  public async startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      
      // Replace video track with screen share track
      const videoTrack = screenStream.getVideoTracks()[0];
      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find((s) => 
          s.track?.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  public disconnect() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.socket.emit('leave-room', { roomId: this.roomId });
  }

  public async createOfferForUser(userId: string) {
    const pc = await this.createPeerConnection(userId);
    if (pc) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('createOfferForUser: Sending offer to user:', userId);
      this.socket.emit('offer', { userId, offer });
    }
  }

  private isNegotiating: Map<string, boolean> = new Map();

  public async renegotiatePeerConnection(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      if (this.isNegotiating.get(userId)) {
        console.log(`Already negotiating with user: ${userId}, skipping renegotiation`);
        return;
      }
      this.isNegotiating.set(userId, true);
      try {
        console.log('Renegotiating peer connection for user:', userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('offer', { userId, offer });
      } catch (error) {
        console.error('Error renegotiating peer connection for user:', userId, error);
      } finally {
        this.isNegotiating.set(userId, false);
      }
    }
  }
}
