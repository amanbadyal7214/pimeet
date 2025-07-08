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
  const [remoteUserStatus, setRemoteUserStatus] = useState<Map<string, { audioEnabled: boolean; videoEnabled: boolean }>>(new Map());

  const webRTCRef = useRef<WebRTCService | null>(null);
  const socketRef = useRef<any>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);

  useEffect(() => {
    const socketService = SocketService.getInstance();
    const socket = socketService.connect('https://backend-l24e.onrender.com');
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
        const displayName = new URLSearchParams(window.location.search).get('name') || 'Guest';
        const stream = await webRTCRef.current?.joinRoom(displayName);
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
      setRemoteUserStatus((prev) => new Map(prev).set(userId, { audioEnabled: true, videoEnabled: true }));
    });

    socket.on('room-users', async ({ users }: { users: User[] }) => {
      const names = new Map<string, string>();
      const statuses = new Map<string, { audioEnabled: boolean; videoEnabled: boolean }>();
      users.forEach(({ userId, displayName }) => {
        names.set(userId, displayName);
        statuses.set(userId, { audioEnabled: true, videoEnabled: true });
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

    socket.on('user-status-update', ({ userId, audioEnabled, videoEnabled }) => {
      setRemoteUserStatus((prev) => {
        const updated = new Map(prev);
        const existing = updated.get(userId) || {};
        updated.set(userId, { ...existing, audioEnabled, videoEnabled });
        return updated;
      });
    });

    connect();

    return () => {
      webRTCRef.current?.disconnect();
      socketService.disconnect();
      setIsConnected(false);
      setLocalStream(null);
      setRemoteStreams(new Map());
      setRemoteUserDisplayNames(new Map());
      setRemoteUserStatus(new Map());
    };
  }, [roomId]);

  const toggleAudio = async (enabled: boolean) => {
    try {
      await webRTCRef.current?.toggleAudio(enabled);
      setLocalAudioEnabled(enabled);
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
      await webRTCRef.current?.toggleVideo(enabled);
      setLocalVideoEnabled(enabled);
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
      return await webRTCRef.current?.startScreenShare();
    } catch (error) {
      console.error('Screen share failed:', error);
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
    localAudioEnabled,
    localVideoEnabled,
  };
}
