import { useEffect, useRef, useState } from 'react';
import { WebRTCService } from '../services/webrtc';
import { SocketService } from '../services/socket';

interface User {
  userId: string;
  displayName: string;
}

export function useWebRTC(roomId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteUserDisplayNames, setRemoteUserDisplayNames] = useState<Map<string, string>>(new Map());
  const [remoteUserStatus, setRemoteUserStatus] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>>(new Map());
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);

  const webRTCRef = useRef<WebRTCService | null>(null);
  const socketRef = useRef<any>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);

  useEffect(() => {
    const socketService = SocketService.getInstance();
    //const socket = socketService.connect('https://pi.comsdesk.com'); // Adjust URL as needed
     const socket = socketService.connect('http://localhost:3001');
    socketRef.current = socket;

    webRTCRef.current = new WebRTCService(socket, roomId, (userId, stream) => {
      setRemoteStreams((prev) => {
        const updated = new Map(prev);
        updated.set(userId, stream);
        return updated;
      });

      if (userId === 'local') {
        setLocalStream(stream); // 💡 Update ref to trigger video rebind
      }
    });

    const connect = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const displayName = params.get('name') || 'Host';
        const studentId = params.get('id') || '';
        // Combine name and studentId for signaling
        const fullName = studentId ? `${displayName} (${studentId})` : displayName;
        const stream = await webRTCRef.current?.joinRoom(fullName);
        if (stream) {
          setLocalStream(new MediaStream(stream.getTracks()));
          setIsConnected(true);
        }
      } catch (error) {
        console.error('❌ Failed to join room:', error);
      }
    };

    socket.on('user-joined', async ({ userId, displayName }: User) => {
      setRemoteUserDisplayNames((prev) => new Map(prev).set(userId, displayName));
      setRemoteUserStatus((prev) => new Map(prev).set(userId, { audioEnabled: true, videoEnabled: true, isScreenSharing: false }));
    });

    socket.on('room-users', async ({ users }: { users: User[] }) => {
      const names = new Map<string, string>();
      const statuses = new Map<string, { audioEnabled: boolean; videoEnabled: boolean; isScreenSharing: boolean }>();
      users.forEach(({ userId, displayName }) => {
        names.set(userId, displayName);
        statuses.set(userId, { audioEnabled: true, videoEnabled: true, isScreenSharing: false });
      });
      setRemoteUserDisplayNames(names);
      setRemoteUserStatus(statuses);
    });

    socket.on('user-left', ({ userId }: { userId: string }) => {
      setRemoteStreams((prev) => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });

      setRemoteUserDisplayNames((prev) => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });

      setRemoteUserStatus((prev) => {
        const updated = new Map(prev);
        updated.delete(userId);
        return updated;
      });
    });

    socket.on('user-status-update', ({ userId, audioEnabled, videoEnabled }: { userId: string; audioEnabled: boolean; videoEnabled: boolean }) => {
      setRemoteUserStatus((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(userId) || { audioEnabled: true, videoEnabled: true, isScreenSharing: false };
        updated.set(userId, { ...existing, audioEnabled, videoEnabled });
        return updated;
      });
    });

    // Listen for screen sharing events
    socket.on('screen-share-started', ({ userId }: { userId: string }) => {
      setRemoteUserStatus((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(userId) || { audioEnabled: true, videoEnabled: true, isScreenSharing: false };
        updated.set(userId, { ...existing, isScreenSharing: true });
        return updated;
      });
    });

    socket.on('screen-share-stopped', ({ userId }: { userId: string }) => {
      setRemoteUserStatus((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(userId) || { audioEnabled: true, videoEnabled: true, isScreenSharing: false };
        updated.set(userId, { ...existing, isScreenSharing: false });
        return updated;
      });
    });

    connect();

    return () => {
      webRTCRef.current?.disconnect();
      socketService.disconnect();
      setIsConnected(false);
      setLocalStream(null);
      setScreenShareStream(null);
      setRemoteStreams(new Map());
      setRemoteUserDisplayNames(new Map());
      setRemoteUserStatus(new Map());
    };
  }, [roomId]);

  const toggleAudio = async (enabled: boolean) => {
    try {
      console.log('Toggling audio:', enabled);
      await webRTCRef.current?.toggleAudio(enabled);
      setLocalAudioEnabled(enabled);
      console.log('Emitting user-status-update with audioEnabled:', enabled, 'videoEnabled:', localVideoEnabled);
      socketRef.current?.emit('user-status-update', {
        audioEnabled: enabled,
        videoEnabled: localVideoEnabled,
      });
    } catch (error) {
      console.error('Toggle audio failed:', error);
    }
  };

  const toggleVideo = async (enabled: boolean) => {
    try {
      console.log('toggleVideo called with enabled:', enabled);
      await webRTCRef.current?.toggleVideo(enabled);
      setLocalVideoEnabled(enabled);
      
      // If enabling video after screen share, ensure we have a working camera track
      if (enabled && !isLocalScreenSharing) {
        // Small delay to let the toggleVideo complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if we actually have a working video track
        const currentStream = webRTCRef.current?.getLocalStream();
        const videoTracks = currentStream?.getVideoTracks() || [];
        const hasWorkingVideoTrack = videoTracks.some(track => 
          track.readyState === 'live' && 
          !track.label.toLowerCase().includes('blank') &&
          track.enabled
        );
        
        console.log('Video tracks after toggleVideo:', videoTracks.map(t => `${t.label}:${t.readyState}:${t.enabled}`));
        
        if (!hasWorkingVideoTrack) {
          console.log('No working camera track found, attempting to restore camera');
          try {
            await webRTCRef.current?.restoreCameraAfterScreenShare();
            console.log('Camera restoration completed in toggleVideo');
          } catch (error) {
            console.error('Failed to restore camera in toggleVideo:', error);
          }
        }
      }
      
      socketRef.current?.emit('user-status-update', {
        audioEnabled: localAudioEnabled,
        videoEnabled: enabled,
      });
    } catch (error) {
      console.error('Toggle video failed:', error);
    }
  };

  const startScreenShare = async () => {
    try {
      if (!webRTCRef.current) {
        throw new Error('WebRTC service not initialized');
      }

      // Use WebRTC service's startScreenShare method which properly handles peer connections
      const stream = await webRTCRef.current.startScreenShare();
      setIsLocalScreenSharing(true);
      
      // The screen share stream becomes the main localStream, so we set it as screenShareStream
      // for the UI to distinguish between camera and screen share
      setScreenShareStream(stream);

      // Handle stream stop
      stream.getVideoTracks()[0].onended = async () => {
        console.log('=== SCREEN SHARE ENDED BY BROWSER ===');
        
        try {
          setScreenShareStream(null);
          setIsLocalScreenSharing(false);
          
          // Small delay to ensure state updates are processed
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Restore camera using direct method
          if (webRTCRef.current) {
            await webRTCRef.current.restoreCameraAfterScreenShare();
            console.log('Camera restored after browser stop');
          }
          
          // Enable video state
          setLocalVideoEnabled(true);
          
          // Another small delay before emitting
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Emit status update
          socketRef.current?.emit('user-status-update', {
            audioEnabled: localAudioEnabled,
            videoEnabled: true,
          });
          
          // Emit screen share stop event
          socketRef.current?.emit('screen-share-stopped', { roomId });
          
          console.log('=== BROWSER SCREEN SHARE END COMPLETED ===');
        } catch (error) {
          console.error('Error handling browser screen share end:', error);
          // Ensure UI state is restored even if there's an error
          setScreenShareStream(null);
          setIsLocalScreenSharing(false);
          setLocalVideoEnabled(true);
        }
      };

      return stream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  };

  const stopScreenShare = async () => {
    try {
      if (!webRTCRef.current) {
        throw new Error('WebRTC service not initialized');
      }

      console.log('=== STOPPING SCREEN SHARE ===');
      console.log('Current localVideoEnabled state:', localVideoEnabled);
      
      // Stop screen sharing first
      await webRTCRef.current.stopScreenShare();
      console.log('WebRTC stopScreenShare completed');
      
      // Update states immediately
      setScreenShareStream(null);
      setIsLocalScreenSharing(false);
      console.log('Screen share states updated');
      
      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Restore camera using direct method
      await webRTCRef.current.restoreCameraAfterScreenShare();
      console.log('Camera restoration completed');
      
      // Force enable video state and trigger re-render
      setLocalVideoEnabled(true);
      console.log('Video enabled in UI');
      
      // Another small delay before emitting status
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Emit status update
      socketRef.current?.emit('user-status-update', {
        audioEnabled: localAudioEnabled,
        videoEnabled: true,
      });
      
      // Emit screen share stop event
      socketRef.current?.emit('screen-share-stopped', { roomId });
      
      console.log('=== SCREEN SHARE STOP COMPLETED ===');
    } catch (error) {
      console.error('Failed to stop screen share:', error);
      // Even if there's an error, try to restore the UI state
      setScreenShareStream(null);
      setIsLocalScreenSharing(false);
      setLocalVideoEnabled(true);
      throw error;
    }
  };

  return {
    isConnected,
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    remoteUserStatus,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    screenShareStream,
    isLocalScreenSharing,
    localAudioEnabled,
    localVideoEnabled,
  };
}
