import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MeetingControls from '../components/meeting/MeetingControls';
import ChatPanel from '../components/meeting/ChatPanel';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { formatTime } from '../utils/meeting';
import { useWebRTC } from '../hooks/useWebRTC';
import ParticipantThumbnail from '../components/meeting/ParticipantThumbnail';
import TaskList from '../components/meeting/TaskList';
import MessageArea from '../components/meeting/MessageArea';

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
    if (remoteUserDisplayNames.size > 0) {
      const firstUserId = Array.from(remoteUserDisplayNames.keys())[0];
      setHostUserId(firstUserId);
    } else if (meetingId) {
      setHostUserId('local');
    }
  }, [remoteUserDisplayNames, meetingId]);

  const [participants, setParticipants] = React.useState<
    {
      userId: string;
      name: string;
      role: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
      stream?: MediaStream;
    }[]
  >([]);

  React.useEffect(() => {
    const newParticipants = [];

    // Add local user
    newParticipants.push({
      userId: 'local',
      name: displayName,
      role: 'You',
      audioEnabled,
      videoEnabled,
      stream: localStream || undefined,
    });

    // Add remote users
    remoteUserDisplayNames.forEach((name, userId) => {
      newParticipants.push({
        userId,
        name,
        role: 'Participant',
        audioEnabled: true,
        videoEnabled: true,
        stream: remoteStreams.get(userId),
      });
    });

    setParticipants(newParticipants);
  }, [localStream, remoteStreams, remoteUserDisplayNames, audioEnabled, videoEnabled, displayName]);

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

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-gray-900 p-6 space-y-6 rounded-3xl">
      <div className="flex flex-1 space-x-6 overflow-hidden">
        {/* Left Panel */}
        <div className="flex flex-col space-y-6 w-96">
          <div className="grid grid-cols-2 gap-4">
            {participants.slice(0, 4).map((participant) => (
              <ParticipantThumbnail
                key={participant.userId}
                name={participant.name}
                role={participant.role}
                videoStream={participant.stream}
                videoEnabled={participant.videoEnabled}
                audioEnabled={participant.audioEnabled}
                isLocal={participant.userId === 'local'}
              />
            ))}
            <div className="bg-gray-700 rounded-xl flex flex-col items-center justify-center text-white text-2xl font-semibold">
              24+
            </div>
          </div>
          <TaskList />
        </div>

        {/* Main Video Area */}
        <div className="flex-1 flex flex-col rounded-3xl overflow-hidden bg-gray-900 shadow-lg relative">
          {localStream ? (
            <video
              ref={(el) => {
                if (el) {
                  el.srcObject = localStream;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover rounded-3xl"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white text-4xl font-bold">
              You
            </div>
          )}

          {/* Controls Overlay */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 bg-black bg-opacity-50 rounded-full p-3 shadow-lg">
            <MeetingControls
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              isChatOpen={isChatOpen}
              participantCount={participants.length}
              meetingTime={formatTime(meetingTime)}
              displayName={displayName}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleChat={handleToggleChat}
              onShareScreen={handleShareScreen}
              onLeaveMeeting={handleLeaveMeeting}
              onShowParticipants={handleShowParticipants}
              onMoreOptions={handleMoreOptions}
              className="flex-row space-x-4 bg-transparent shadow-none p-0"
            />
          </div>
        </div>
      </div>

      {/* Message Area */}
      <MessageArea />

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
