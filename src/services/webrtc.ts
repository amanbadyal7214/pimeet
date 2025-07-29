import { Socket } from 'socket.io-client';

export class WebRTCService {
  private peerConnections = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private roomId: string;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private currentVideoTrack: MediaStreamTrack | null = null;

  constructor(socket: Socket, roomId: string, onRemoteStream?: (userId: string, stream: MediaStream) => void) {
    this.socket = socket;
    this.roomId = roomId;
    this.onRemoteStream = onRemoteStream || null;
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on('room-users', async ({ users }) => {
      for (const { userId } of users) {
        const pc = await this.createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.emit('offer', { userId, offer });
      }
    });

    this.socket.on('user-joined', async ({ userId }) => {
      if (!this.peerConnections.has(userId)) {
        await this.createPeerConnection(userId);
      }
    });

    this.socket.on('offer', async ({ userId, offer }) => {
      const pc = await this.createPeerConnection(userId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socket.emit('answer', { userId, answer });
    });

    this.socket.on('answer', async ({ userId, answer }) => {
      const pc = this.peerConnections.get(userId);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    this.socket.on('ice-candidate', async ({ userId, candidate }) => {
      const pc = this.peerConnections.get(userId);
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    this.socket.on('user-left', ({ userId }) => {
      const pc = this.peerConnections.get(userId);
      if (pc) {
        pc.close();
        this.peerConnections.delete(userId);
      }
    });
  }

  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(userId)) return this.peerConnections.get(userId)!;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.socket.emit('ice-candidate', { userId, candidate: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      this.onRemoteStream?.(userId, ev.streams[0]);
    };

    await this.waitForLocalStream();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    this.peerConnections.set(userId, pc);
    return pc;
  }

  private async waitForLocalStream() {
    if (this.localStream) return;
    await new Promise<void>((resolve) => {
      const check = () => (this.localStream ? resolve() : setTimeout(check, 100));
      check();
    });
  }

  public async joinRoom(displayName?: string): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    this.currentVideoTrack = this.localStream.getVideoTracks()[0] || null;
    this.socket.emit('join-room', { roomId: this.roomId, displayName });
    this.onRemoteStream?.('local', new MediaStream(this.localStream.getTracks()));
    return this.localStream;
  }

  public getLocalStream() {
    return this.localStream;
  }

  private blankVideoTrack: MediaStreamTrack | null = null;

  private createBlankVideoTrack(): MediaStreamTrack {
    if (this.blankVideoTrack) return this.blankVideoTrack;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream();
    this.blankVideoTrack = stream.getVideoTracks()[0];
    return this.blankVideoTrack;
  }

  public async toggleVideo(enabled: boolean) {
    if (!this.localStream) return;

    // Preserve audio tracks
    const audioTracks = this.localStream.getAudioTracks();

    if (!enabled) {
      // Replace current video track with blank video track to simulate video off
      const blankTrack = this.createBlankVideoTrack();
      if (this.currentVideoTrack) {
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === this.currentVideoTrack);
          if (sender) sender.replaceTrack(blankTrack);
        });
        this.localStream.removeTrack(this.currentVideoTrack);
      }
      this.localStream.addTrack(blankTrack);
      this.currentVideoTrack = blankTrack;
    } else {
      // Restore real video track
      if (this.currentVideoTrack && this.currentVideoTrack === this.blankVideoTrack) {
        this.localStream.removeTrack(this.blankVideoTrack!);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const realTrack = stream.getVideoTracks()[0];
        this.currentVideoTrack = realTrack;
        this.localStream.addTrack(realTrack);
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === this.blankVideoTrack);
          if (sender) sender.replaceTrack(realTrack);
        });
      } else if (!this.currentVideoTrack) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const realTrack = stream.getVideoTracks()[0];
        this.currentVideoTrack = realTrack;
        this.localStream.addTrack(realTrack);
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(realTrack);
        });
      }
    }

    // Re-add audio tracks to localStream if missing
    audioTracks.forEach(track => {
      if (!this.localStream!.getAudioTracks().includes(track)) {
        this.localStream!.addTrack(track);
      }
    });

    // Emit updated stream
    const newStream = new MediaStream(this.localStream.getTracks());
    this.onRemoteStream?.('local', newStream);
  }

  public async toggleAudio(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(t => {
      t.enabled = enabled;
      // Also mute/unmute the track explicitly if supported
      if ('muted' in t) {
        (t as any).muted = !enabled;
      }
    });
    const updated = new MediaStream(this.localStream.getTracks());
    this.onRemoteStream?.('local', updated);
  }

  public async startScreenShare(): Promise<MediaStream> {
    if (!this.localStream) throw new Error('No local stream');
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screen.getVideoTracks()[0];

    this.peerConnections.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(screenTrack);
    });

    this.localStream.getVideoTracks().forEach(t => {
      this.localStream!.removeTrack(t);
      t.stop();
    });

    this.localStream.addTrack(screenTrack);
    this.onRemoteStream?.('local', new MediaStream(this.localStream.getTracks()));

    screenTrack.onended = async () => {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const camTrack = cam.getVideoTracks()[0];

      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      });

      this.localStream!.removeTrack(screenTrack);
      screenTrack.stop();
      this.localStream!.addTrack(camTrack);
      this.onRemoteStream?.('local', new MediaStream(this.localStream.getTracks()));
    };

    return screen;
  }

  private replaceTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) {
    this.peerConnections.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track === oldTrack);
      if (sender) {
        console.log(`Replacing track in peer connection for user: ${[...this.peerConnections.entries()].find(([_, v]) => v === pc)?.[0]}`);
        console.log('Old track:', oldTrack);
        console.log('New track:', newTrack);
        sender.replaceTrack(newTrack);
      }
    });
  }

  private createBlankVideoTrack(): MediaStreamTrack {
    if (this.blankVideoTrack) return this.blankVideoTrack;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream();
    this.blankVideoTrack = stream.getVideoTracks()[0];
    return this.blankVideoTrack;
  }

  public disconnect() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.socket.emit('leave-room', { roomId: this.roomId });
  }
}
