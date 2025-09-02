import { Socket } from 'socket.io-client';

export class WebRTCService {
  private peerConnections = new Map<string, RTCPeerConnection>();
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private roomId: string;
  private onRemoteStream: ((userId: string, stream: MediaStream) => void) | null = null;
  private currentVideoTrack: MediaStreamTrack | null = null;
  private blankVideoTrack: MediaStreamTrack | null = null;

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
    console.log('=== toggleVideo called ===');
    console.log('enabled:', enabled);
    console.log('currentVideoTrack:', this.currentVideoTrack ? this.currentVideoTrack.label : 'null');
    
    if (!this.localStream) {
      console.log('No localStream available');
      return;
    }

    // Preserve audio tracks
    const audioTracks = this.localStream.getAudioTracks();
    console.log('Current audio tracks:', audioTracks.length);

    if (!enabled) {
      console.log('Disabling video - replacing with blank track');
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
      console.log('Enabling video - getting fresh camera stream');
      
      try {
        // Always get a fresh camera stream when enabling video
        console.log('Getting fresh camera stream...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const realTrack = stream.getVideoTracks()[0];
        console.log('Got fresh camera track:', realTrack.label);
        
        // Remove any existing video track
        if (this.currentVideoTrack) {
          console.log('Removing existing video track:', this.currentVideoTrack.label);
          this.localStream.removeTrack(this.currentVideoTrack);
          this.currentVideoTrack.stop();
        }
        
        // Add new camera track
        this.localStream.addTrack(realTrack);
        this.currentVideoTrack = realTrack;
        console.log('Added new camera track to localStream');
        
        // Replace track in all peer connections
        this.peerConnections.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            console.log('Replacing track in peer connection');
            sender.replaceTrack(realTrack);
          }
        });
        
      } catch (error) {
        console.error('Failed to get camera stream:', error);
        throw error;
      }
    }

    // Re-add audio tracks to localStream if missing
    audioTracks.forEach(track => {
      if (!this.localStream!.getAudioTracks().includes(track)) {
        this.localStream!.addTrack(track);
      }
    });

    console.log('Final localStream tracks:', this.localStream.getTracks().map(t => t.kind + ':' + t.label));
    
    // Emit updated stream
    const newStream = new MediaStream(this.localStream.getTracks());
    this.onRemoteStream?.('local', newStream);
    console.log('toggleVideo completed, new stream emitted');
  }

  public async toggleAudio(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getAudioTracks().forEach(t => {
      t.enabled = enabled;
    });
    const updated = new MediaStream(this.localStream.getTracks());
    this.onRemoteStream?.('local', updated);
  }

  public async startScreenShare(): Promise<MediaStream> {
    if (!this.localStream) throw new Error('No local stream');
    
    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported on this device/browser');
      }

      // Mobile-specific handling
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      let screen: MediaStream;
      
      if (isMobile) {
        // Mobile devices - use optimized settings
        const constraints = {
          video: {
            frameRate: { ideal: 15, max: 30 },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          } as MediaTrackConstraints,
          audio: true, // Include audio for mobile
        };
        
        try {
          screen = await navigator.mediaDevices.getDisplayMedia(constraints);
        } catch (error) {
          console.error('Mobile screen share failed:', error);
          
          // Fallback for iOS Safari
          if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            alert('Screen sharing on iOS requires iOS 15+ and may need to be enabled in Settings > Safari > Advanced > Experimental Features');
          }
          throw error;
        }
      } else {
        // Desktop - use original settings
        screen = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: true 
        });
      }
      
      const screenTrack = screen.getVideoTracks()[0];

      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack).catch(error => {
            console.error('Failed to replace video track for screen share:', error);
          });
        }
      });

      // Notify other participants about screen sharing
      this.socket.emit('screen-share-started', { roomId: this.roomId });

      this.localStream.getVideoTracks().forEach(t => {
        this.localStream!.removeTrack(t);
        t.stop();
      });

      this.localStream.addTrack(screenTrack);
      this.onRemoteStream?.('local', new MediaStream(this.localStream.getTracks()));

      screenTrack.onended = async () => {
        try {
          console.log('Screen track ended, cleaning up...');
          
          // Notify other participants that screen sharing stopped
          this.socket.emit('screen-share-stopped', { roomId: this.roomId });

          // Remove and stop the screen track
          this.localStream!.removeTrack(screenTrack);
          screenTrack.stop();
          
          // Reset current video track
          if (this.currentVideoTrack === screenTrack) {
            this.currentVideoTrack = null;
            console.log('Reset currentVideoTrack to null after screen ended');
          }
          
          console.log('Screen track cleanup completed');
        } catch (error) {
          console.error('Failed to cleanup after screen share ended:', error);
        }
      };

      return screen;
    } catch (error) {
      console.error('Screen share error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Screen sharing failed. ';
      
      if (error instanceof Error) {
        if (error.message.includes('NotAllowedError')) {
          errorMessage += 'Please allow screen recording permission.';
        } else if (error.message.includes('NotFoundError')) {
          errorMessage += 'No screen sources available.';
        } else if (error.message.includes('NotSupportedError')) {
          errorMessage += 'Your browser/device does not support screen sharing.';
        } else {
          errorMessage += error.message;
        }
      }
      
      // Show alert on mobile devices
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        alert(errorMessage);
      }
      
      throw new Error(errorMessage);
    }
  }

  public async stopScreenShare(): Promise<void> {
    console.log('=== WebRTC stopScreenShare called ===');
    if (!this.localStream) {
      console.log('No localStream available for stopScreenShare');
      return;
    }
    
    try {
      // Get current screen share tracks and stop them
      const videoTracks = this.localStream.getVideoTracks();
      console.log('Current video tracks before stopping screen share:', videoTracks.map(t => t.kind + ':' + t.label));
      
      // Stop and remove screen share tracks
      let screenTrackFound = false;
      videoTracks.forEach(track => {
        // Screen share tracks usually have labels containing "screen" or have contentHint
        if (track.label.toLowerCase().includes('screen') || 
            track.contentHint === 'detail' || 
            track.label.toLowerCase().includes('display')) {
          console.log('Removing screen track:', track.label);
          this.localStream!.removeTrack(track);
          track.stop();
          screenTrackFound = true;
          // Reset current video track if it was the screen share track
          if (this.currentVideoTrack === track) {
            this.currentVideoTrack = null;
            console.log('Reset currentVideoTrack to null');
          }
        }
      });
      
      // If no specific screen track found, remove all video tracks as fallback
      if (!screenTrackFound && videoTracks.length > 0) {
        console.log('No screen track identified by label, removing all video tracks');
        videoTracks.forEach(track => {
          console.log('Removing video track:', track.label);
          this.localStream!.removeTrack(track);
          track.stop();
        });
        this.currentVideoTrack = null;
      }

      // Notify other participants that screen sharing stopped
      this.socket.emit('screen-share-stopped', { roomId: this.roomId });
      
      console.log('Tracks after screen share cleanup:', this.localStream.getTracks().map(t => `${t.kind}:${t.label}`));
      console.log('=== WebRTC stopScreenShare completed ===');
    } catch (error) {
      console.error('Failed to stop screen share:', error);
      throw error;
    }
  }

  public async restoreCameraAfterScreenShare(): Promise<void> {
    console.log('=== Restoring camera after screen share ===');
    
    try {
      // Get fresh camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const cameraTrack = stream.getVideoTracks()[0];
      console.log('Got fresh camera track:', cameraTrack.label);
      
      // Ensure we have a clean slate - remove any existing video tracks
      const existingVideoTracks = this.localStream!.getVideoTracks();
      existingVideoTracks.forEach(track => {
        console.log('Removing existing video track:', track.label);
        this.localStream!.removeTrack(track);
        track.stop();
      });
      
      // Add new camera track to local stream
      this.localStream!.addTrack(cameraTrack);
      this.currentVideoTrack = cameraTrack;
      console.log('Added camera track to localStream');
      
      // Replace in all peer connections with proper error handling
      const replacePromises: Promise<void>[] = [];
      this.peerConnections.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video' || s.track === null);
        if (sender) {
          console.log('Replacing video track in peer connection');
          const replacePromise = sender.replaceTrack(cameraTrack).catch(error => {
            console.error('Failed to replace track:', error);
            // Don't throw, just log the error
          });
          replacePromises.push(replacePromise);
        } else {
          // If no sender found, add the track
          console.log('No video sender found, adding track to peer connection');
          try {
            pc.addTrack(cameraTrack, this.localStream!);
          } catch (error) {
            console.error('Failed to add track to peer connection:', error);
          }
        }
      });
      
      // Wait for all track replacements to complete
      await Promise.all(replacePromises);
      console.log('All peer connection track replacements completed');
      
      // Create fresh stream and emit it to force UI update
      const newStream = new MediaStream(this.localStream!.getTracks());
      console.log('Emitting new stream with tracks:', newStream.getTracks().map(t => `${t.kind}:${t.label}`));
      this.onRemoteStream?.('local', newStream);
      
      // Small delay to ensure everything is properly set up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Camera restored and stream emitted successfully');
      
    } catch (error) {
      console.error('Failed to restore camera:', error);
      throw error;
    }
  }

  public disconnect() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.socket.emit('leave-room', { roomId: this.roomId });
  }
}
