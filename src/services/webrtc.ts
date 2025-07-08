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

  public async toggleVideo(enabled: boolean) {
    if (!this.localStream) return;

    const oldTrack = this.localStream.getVideoTracks()[0];
    if (!enabled) {
      const blankTrack = this.createBlankVideoTrack();
      this.replaceTrack(oldTrack, blankTrack);
      this.localStream.removeTrack(oldTrack);
      oldTrack.stop();
      this.localStream.addTrack(blankTrack);
      this.currentVideoTrack = null;
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const realTrack = stream.getVideoTracks()[0];
      const currentTrack = this.localStream.getVideoTracks()[0];
      this.replaceTrack(currentTrack, realTrack);
      this.localStream.removeTrack(currentTrack);
      currentTrack.stop();
      this.localStream.addTrack(realTrack);
      this.currentVideoTrack = realTrack;
    }

    // 🔁 Return updated stream reference
    const newStream = new MediaStream(this.localStream.getTracks());
    this.onRemoteStream?.('local', newStream);
  }

  public async toggleAudio(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(t => t.enabled = enabled);
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
      if (sender) sender.replaceTrack(newTrack);
    });
  }

  private createBlankVideoTrack(): MediaStreamTrack {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream();
    return stream.getVideoTracks()[0];
  }

  public disconnect() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.socket.emit('leave-room', { roomId: this.roomId });
  }
}
