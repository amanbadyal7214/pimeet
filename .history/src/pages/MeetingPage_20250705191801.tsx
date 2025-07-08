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
  const [layout, setLayout] = useState<'grid' | 'spotlight'>('spotlight');

  const {
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    toggleAudio,
    toggleVideo,
    startScreenShare,
  } = useWebRTC(meetingId || '');

  const [hostUserId, setHostUserId] = React.useState<string | null>(null);
  const [spotlightUserId, setSpotlightUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (remoteUserDisplayNames.size > 0) {
      const firstUserId = Array.from(remoteUserDisplayNames.keys())[0];
      setHostUserId(firstUserId);
      setSpotlightUserId(firstUserId);
    } else if (meetingId) {
      setHostUserId('local');
      setSpotlightUserId('local');
    }
  }, [remoteUserDisplayNames, meetingId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingTime((prev) => prev + 1);
    }, 1000);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      setShowConfirmLeave(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement) {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch((error) => {
              console.error('Error playing remote video for user:', userId, error);
            });
          };
        }
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

  const handleSpotlightChange = (userId: string) => {
    setSpotlightUserId(userId);
    setLayout('spotlight');
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

    const videoTracks = stream.getVideoTracks();
    const videoEnabledForUser = videoTracks.length > 0 && videoTracks.some(track => track.enabled);

    return (
      <div
        className={`relative bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer ${
          spotlightUserId === userId ? 'ring-4 ring-blue-500' : ''
        }`}
        onClick={() => handleSpotlightChange(userId)}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${!videoEnabledForUser ? 'hidden' : ''}`}
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
        <div className={`flex-1 ${isChatOpen ? 'md:mr-80' : ''} flex flex-col`}>
          {layout === 'spotlight' && spotlightUserId ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 bg-gray-900 rounded-lg shadow-lg mb-4">
                {spotlightUserId === 'local' ? (
                  localStream && renderParticipantVideo(localStream, displayName, true)
                ) : (
                  remoteStreams.has(spotlightUserId) &&
                  renderParticipantVideo(remoteStreams.get(spotlightUserId)!, spotlightUserId)
                )}
              </div>
              <div className="flex space-x-4 overflow-x-auto px-4">
                {Array.from(remoteUserDisplayNames)
                  .filter(([userId]) => userId !== spotlightUserId)
                  .map(([userId]) => {
                    const stream = remoteStreams.get(userId);
                    if (!stream) return null;
                    return (
                      <div key={userId} className="w-24 h-24 flex-shrink-0">
                        {renderParticipantVideo(stream, userId)}
                      </div>
                    );
                  })}
                {spotlightUserId !== 'local' && localStream && (
                  <div className="w-24 h-24 flex-shrink-0">
                    {renderParticipantVideo(localStream, displayName, true)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 p-4 overflow-auto">
              {localStream && renderParticipantVideo(localStream, displayName, true)}
              {Array.from(remoteUserDisplayNames).map(([userId, name]) => {
                const stream = remoteStreams.get(userId);
                if (!stream) return null;
                return renderParticipantVideo(stream, userId);
              })}
            </div>
          )}
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
