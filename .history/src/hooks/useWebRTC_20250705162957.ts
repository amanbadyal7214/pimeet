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
  const [localUserId, setLocalUserId] = useState<string | undefined>(undefined);
  const webRTCRef = useRef<WebRTCService | null>(null);

  useEffect(() => {
    const socketService = SocketService.getInstance();
    const socket = socketService.connect('http://localhost:3001');
    webRTCRef.current = new WebRTCService(socket, roomId, (userId, stream) => {
      console.log('Remote stream received for user:', userId, stream);
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, stream);
        return newMap;
      });
    });

    const connect = async () => {
      try {
        const displayName = new URLSearchParams(window.location.search).get('name') || 'Guest';
        const stream = await webRTCRef.current?.joinRoom(displayName);
        if (stream) {
          console.log('Local stream obtained');
          setLocalStream(stream);
          setIsConnected(true);
          const userId = webRTCRef.current?.getLocalUserId();
          setLocalUserId(userId);
        }
      } catch (error) {
        console.error('Failed to join room:', error);
      }
    };

    // Listen for updates to remote user display names
    socket.on('user-joined', async (data: User) => {
      console.log('Socket event user-joined:', data);
      const { userId, displayName } = data;
      setRemoteUserDisplayNames((prev) => new Map(prev).set(userId, displayName));
      // Trigger peer connection renegotiation
      if (webRTCRef.current) {
        await webRTCRef.current.renegotiatePeerConnection(userId);
      }
    });

    socket.on('room-users', async (data: { users: User[] }) => {
      console.log('Socket event room-users:', data);
      const { users } = data;
      const newMap = new Map<string, string>();
      users.forEach(({ userId, displayName }) => {
        newMap.set(userId, displayName);
      });
      setRemoteUserDisplayNames(newMap);
      // Trigger peer connection renegotiation for all users
      if (webRTCRef.current) {
        for (const { userId } of users) {
          await webRTCRef.current.renegotiatePeerConnection(userId);
        }
      }
    });

    connect();

    return () => {
      webRTCRef.current?.disconnect();
      socketService.disconnect();
      setIsConnected(false);
      setLocalStream(null);
      setRemoteStreams(new Map());
      setRemoteUserDisplayNames(new Map());
      setLocalUserId(undefined);
    };
  }, [roomId]);

  const toggleAudio = async (enabled: boolean) => {
    await webRTCRef.current?.toggleAudio(enabled);
  };

  const toggleVideo = async (enabled: boolean) => {
    await webRTCRef.current?.toggleVideo(enabled);
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await webRTCRef.current?.startScreenShare();
      return screenStream;
    } catch (error) {
      console.error('Failed to start screen share:', error);
      throw error;
    }
  };

  return {
    isConnected,
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    localUserId,
    toggleAudio,
    toggleVideo,
    startScreenShare,
  };
}
