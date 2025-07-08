import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MeetingControls from '../components/meeting/MeetingControls';
import ChatPanel from '../components/meeting/ChatPanel';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { formatTime } from '../utils/meeting';
import { useWebRTC } from '../hooks/useWebRTC';

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const displayName = searchParams.get('name') || 'Guest';
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'spotlight'>('grid');
  
  const {
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    toggleAudio,
    toggleVideo,
    startScreenShare,
  } = useWebRTC(meetingId || '');

  const [hostUserId, setHostUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Assume the first user in remoteUserDisplayNames or local user is host
    if (remoteUserDisplayNames.size > 0) {
      const firstUserId = Array.from(remoteUserDisplayNames.keys())[0];
      setHostUserId(firstUserId);
    } else if (meetingId) {
      // If no remote users, local user is host
      setHostUserId('local');
    }
  }, [remoteUserDisplayNames, meetingId]);

  console.log('MeetingPage: localStream:', localStream);
  console.log('MeetingPage: remoteStreams:', remoteStreams);
  console.log('MeetingPage: remoteUserDisplayNames:', remoteUserDisplayNames);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingTime((prev) => prev + 1);
    }, 1000);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Call leave meeting logic here
      setShowConfirmLeave(true);
      // Optionally, disconnect immediately
      // webRTCRef.current?.disconnect();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Setting local video srcObject', localStream);
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement) {
        console.log('Setting remote video srcObject for user:', userId, stream);
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch((error) => {
              console.error('Error playing remote video for user:', userId, error);
            });
          };
        }
      } else {
        console.warn('No video element found for user:', userId);
      }
    });
  }, [remoteStreams]);

  const handleToggleAudio = async () => {
    await toggleAudio(!audioEnabled);
    setAudioEnabled(!audioEnabled);
  };

  const handleToggleVideo = async () => {
    await toggleVideo(!videoEnabled);
    setVideoEnabled(!videoEnabled);
  };

  const handleToggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleShareScreen = async () => {
    try {
      await startScreenShare();
    } catch (error) {
      console.error('Failed to share screen:', error);
    }
  };

  const handleLeaveMeeting = () => {
    setShowConfirmLeave(true);
  };

  const confirmLeaveMeeting = () => {
    navigate('/');
  };

  const handleShowParticipants = () => {
    // Implement participants list
  };

  const handleMoreOptions = () => {
    setLayout(layout === 'grid' ? 'spotlight' : 'grid');
  };

    const renderParticipantVideo = (stream: MediaStream, userId: string, isLocal: boolean = false) => {
      const videoRef = isLocal ? localVideoRef : (el: HTMLVideoElement | null) => {
        if (el) {
          remoteVideoRefs.current.set(userId, el);
        } else {
          remoteVideoRefs.current.delete(userId);
        }
      };
    
      const userName = isLocal ? displayName : remoteUserDisplayNames.get(userId) || 'Unknown';
    
      // Determine if video is enabled for this user
      const videoTracks = stream.getVideoTracks();
      console.log(`Video tracks for user ${userName}:`, videoTracks);
      const videoEnabledForUser = videoTracks.length > 0 && videoTracks.some(track => track.enabled);
      console.log(`Video enabled for user ${userName}:`, videoEnabledForUser);
    
      return (
        <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg z-50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            // Temporarily remove hidden class to test visibility
            // className={`w-full h-full object-cover ${!videoEnabledForUser ? 'hidden' : ''}`}
            className="w-full h-full object-cover"
          />
          {!videoEnabledForUser && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 z-20 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">
            {userName}
            {isLocal && ' (You)'}
            {(userId === hostUserId || (isLocal && hostUserId === 'local')) && ' (Host)'}
          </div>
        </div>
      );
    };
  

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 ${isChatOpen ? 'md:mr-80' : ''}`}>
          <div className={`p-4 h-full overflow-auto ${
            layout === 'grid' 
              ? 'grid grid-cols-2 gap-4'
              : 'flex flex-col space-y-4'
          }`}>
            {/* Local Video */}
            {localStream && renderParticipantVideo(localStream, displayName, true)}

            {/* Remote Videos */}
            {remoteStreams.size === 0 ? (
              <div className="text-white text-center w-full py-10">
                Waiting for others to join the meeting...
              </div>
            ) : (
              Array.from(remoteUserDisplayNames).map(([userId, displayName]) => {
                const stream = remoteStreams.get(userId);
                if (!stream) {
                  console.warn(`No media stream found for user: ${userId} (${displayName})`);
                  return null;
                }
                return renderParticipantVideo(stream, userId);
              })
            )}
          </div>
        </div>
        
        {isChatOpen && (
          <ChatPanel
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            className="fixed top-0 right-0 bottom-0 w-full md:w-80 md:relative z-10"
          />
        )}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 z-50">
        <MeetingControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isChatOpen={isChatOpen}
          participantCount={remoteStreams.size + 1}
          meetingTime={formatTime(meetingTime)}
          displayName={displayName}
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onToggleChat={handleToggleChat}
          onShareScreen={handleShareScreen}
          onLeaveMeeting={handleLeaveMeeting}
          onShowParticipants={handleShowParticipants}
          onMoreOptions={handleMoreOptions}
        />
      </div>
      
      <Modal
        isOpen={showConfirmLeave}
        onClose={() => setShowConfirmLeave(false)}
        title="Leave Meeting"
      >
        <div className="text-center">
          <p className="mb-4">Are you sure you want to leave this meeting?</p>
          <div className="flex space-x-3 justify-center">
            <Button
              variant="outline"
              onClick={() => setShowConfirmLeave(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmLeaveMeeting}
            >
              Leave
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingPage;