import React, { useState, useEffect, useRef } from 'react';
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import MeetingControls from '../components/meeting/MeetingControls';
import ChatPanel from '../components/meeting/ChatPanel';
import Button from '../components/ui/Button';
import { formatTime } from '../utils/meeting';
import { useWebRTC } from '../hooks/useWebRTC';
import ParticipantThumbnail from '../components/meeting/ParticipantThumbnail';
import TaskList from '../components/meeting/TaskList';
import Avatar from '../components/ui/Avatar';
import { Drawer, Modal } from 'antd';


const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    creatorName?: string;
    meetingTitle?: string;
  };
  const displayName = state?.creatorName || searchParams.get('name') || 'Guest';
  const title = state?.meetingTitle || 'Untitled Meeting';

  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const pinnedVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const {
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    remoteUserStatus,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    localAudioEnabled,
    localVideoEnabled,
  } = useWebRTC(meetingId || '');

  useEffect(() => {
    const interval = setInterval(() => setMeetingTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updated = [
      {
        userId: 'local',
        name: displayName,
        role: 'You',
        audioEnabled: localAudioEnabled,
        videoEnabled: localVideoEnabled,
        stream: localStream || undefined,
      },
    ];

    remoteUserDisplayNames.forEach((name, userId) => {
      const status = remoteUserStatus.get(userId) || {
        audioEnabled: true,
        videoEnabled: true,
      };
      updated.push({
        userId,
        name,
        role: 'Participant',
        audioEnabled: status.audioEnabled,
        videoEnabled: status.videoEnabled,
        stream: remoteStreams.get(userId),
      });
    });

    setParticipants(updated);
  }, [
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    remoteUserStatus,
    localAudioEnabled,
    localVideoEnabled,
  ]);

  useEffect(() => {
    const pinned = participants.find(p => p.userId === pinnedParticipantId);
    if (pinned?.videoEnabled && pinned?.stream && pinnedVideoRef.current) {
      pinnedVideoRef.current.srcObject = pinned.stream;
    }
  }, [pinnedParticipantId, participants]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleToggleAudio = async () => await toggleAudio(!localAudioEnabled);
  const handleToggleVideo = async () => await toggleVideo(!localVideoEnabled);
  const handleShareScreen = async () => {
    try {
      await startScreenShare();
    } catch (err) {
      console.error('Screen share failed', err);
    }
  };

  const confirmLeaveMeeting = () => navigate('/');
  const handleLeaveMeeting = () => setIsLeaveModalVisible(true);
  const handleShowParticipants = () => setParticipantsDrawerOpen(true);
  const handleShowChat = () => setIsChatDrawerOpen(true);
  const handleShowInfo = () => setIsInfoDrawerOpen(true);

  const handlePinParticipant = (userId: string) => {
    setPinnedParticipantId(userId === pinnedParticipantId ? null : userId);
  };

  const renderMainView = () => {
    const pinned = participants.find(p => p.userId === pinnedParticipantId);

    if (pinned?.videoEnabled && pinned?.stream) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={pinnedVideoRef}
            autoPlay
            muted={pinned.userId === 'local'}
            playsInline
            className="w-full h-full object-cover rounded-xl scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-1 rounded-xl">
            {pinned.name} {pinned.userId === 'local' ? '(You)' : ''}
          </div>
        </div>
      );
    }

    if (localStream && localVideoEnabled) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover rounded-xl transform scale-x-[-1]"
          />
          <div className="absolute bottom-4 left-4 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-1 rounded-xl">
            {displayName} (You)
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-white text-5xl font-bold bg-gradient-to-tr from-gray-800 via-cyan-800 to-gray-800 rounded-xl">
        <Avatar name={displayName} size="xl" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 p-2 fixed top-0 left-0 right-0">
      <div className="flex flex-1 space-x-6 overflow-hidden relative">
        {/* Left Thumbnails */}
        <div className="flex flex-col w-82 max-h-[80vh] overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-2 p-1 gap-4">
            {participants.map((participant) => (
              <ParticipantThumbnail
                key={participant.userId}
                name={participant.name}
                role={participant.role}
                videoStream={participant.stream}
                videoEnabled={participant.videoEnabled}
                audioEnabled={participant.audioEnabled}
                isLocal={participant.userId === 'local'}
                onPin={() => handlePinParticipant(participant.userId)}
                isPinned={pinnedParticipantId === participant.userId}
              />
            ))}
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-gray-100 shadow-lg relative">
          {/* Info Badge Centered */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 group">
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="bg-slate-400 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-300 group-hover:w-48 group-hover:justify-start px-2 bg-opacity-70 overflow-hidden">
                <span className="text-sm rounded-full">ℹ️</span>
                <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {title}
                </span>
              </div>
            </div>
          </div>

          {renderMainView()}

          {/* Controls */}
          <div className="absolute px-3 bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 bg-gray-100 bg-opacity-30 rounded-full p-1 shadow-lg">
            <MeetingControls
              audioEnabled={localAudioEnabled}
              videoEnabled={localVideoEnabled}
              isChatOpen={isChatDrawerOpen}
              participantCount={participants.length}
              meetingTime={formatTime(meetingTime)}
              displayName={displayName}
              onToggleAudio={handleToggleAudio}
              onToggleVideo={handleToggleVideo}
              onToggleChat={handleShowChat}
              onShareScreen={handleShareScreen}
              onLeaveMeeting={handleLeaveMeeting}
              onShowParticipants={handleShowParticipants}
              onMoreOptions={handleShowInfo}
              className="flex-row space-x-4 bg-transparent shadow-none p-0"
            />
          </div>
        </div>
      </div>

      {/* Chat Drawer */}
      <Drawer
        title="Chat"
        placement="right"
        onClose={() => setIsChatDrawerOpen(false)}
        open={isChatDrawerOpen}
        width={350}
      >
        <ChatPanel />
      </Drawer>

      {/* More Info Drawer (Tasks) */}
      <Drawer
        title={null} // Optional: remove header if TaskList has its own
        placement="right"
        onClose={() => setIsInfoDrawerOpen(false)}
        open={isInfoDrawerOpen}
        width={350} // or a fixed width like 600
        bodyStyle={{ padding: 0, height: "100%" }} // remove padding
        closable={false} // optional: if TaskList has its own close button
      >
        <div style={{ height: "100%" }}>
          <TaskList onClose={() => setIsInfoDrawerOpen(false)} />
        </div>
      </Drawer>


      {/* Participants Drawer */}
      <Drawer
        title="Participants"
        placement="right"
        onClose={() => setParticipantsDrawerOpen(false)}
        open={participantsDrawerOpen}
        width={320}
      >
        <div className="space-y-3">
          {participants.map((participant) => (
            <div
              key={participant.userId}
              className="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded-md shadow-sm flex justify-between"
            >
              <span>
                {participant.name}
                {participant.userId === 'local' ? ' (You)' : ''}
              </span>
              <span className="text-xs text-gray-500">
                {participant.audioEnabled ? '🎤' : '🔇'}{' '}
                {participant.videoEnabled ? '🎥' : '🚫'}
              </span>
            </div>
          ))}
        </div>
      </Drawer>

      {/* Leave Meeting Drawer */}
      <Modal
        title="Leave Meeting"
        open={isLeaveModalVisible}
        onCancel={() => setIsLeaveModalVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button
              key="cancel"
              variant="outline"
              onClick={() => setIsLeaveModalVisible(false)}
            >
              Cancel
            </Button>
            <Button key="leave" variant="danger" onClick={confirmLeaveMeeting}>
              Leave
            </Button>
          </div>
        }
      >
        <p className="text-center mb-0">Are you sure you want to leave this meeting?</p>
      </Modal>

    </div>
  );
};

export default MeetingPage;
