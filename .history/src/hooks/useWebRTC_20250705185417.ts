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
    const socket = socketService.connect(`http://${window.location.hostname}:3001`);
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
        // Determine if this user is the host (creator)
        const isHost = window.location.pathname.includes('/meeting') && !window.location.search.includes('joined=true');
        const stream = await webRTCRef.current?.joinRoom(displayName, isHost);
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
      // Trigger peer connection renegotiation for all users including the new user
      if (webRTCRef.current) {
        const allUserIds = Array.from(remoteUserDisplayNames.keys());
        allUserIds.push(userId);
        for (const id of allUserIds) {
          await webRTCRef.current.renegotiatePeerConnection(id);
        }
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
</create_file>

<attempt_completion>
<result>
I have updated the client-side useWebRTC hook to send an isHost flag when joining a room, and the server-side join-room event handler to log a distinct message when a room is created by the host. This will differentiate between room creation and user joining events as requested.

You can now test creating a new meeting and observe the server logs to verify that the room creation message appears when the host creates the room, and user join messages appear for other participants.

This completes the requested feature.
</result>
<command>npm run dev</command>
</attempt_completion>
