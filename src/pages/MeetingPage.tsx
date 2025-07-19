"use client";
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

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

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

  const enterFullscreen = () => {
    const el = pinnedVideoRef.current || localVideoRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
    else if ((el as any)?.webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    else if ((el as any)?.msRequestFullscreen) (el as any).msRequestFullscreen();
  };

  useEffect(() => {
    if (isMobile) {
      setTimeout(() => {
        enterFullscreen();
      }, 1500);
    }
  }, [localStream, pinnedParticipantId]);

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
            className="w-full h-screen object-cover rounded-xl scale-x-[-1]"
          />
          {isMobile && (
            <button
              onClick={enterFullscreen}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-md text-sm"
            >
              Fullscreen
            </button>
          )}
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
            className="w-full h-screen object-cover rounded-xl transform scale-x-[-1]"
          />
          {isMobile && (
            <button
              onClick={enterFullscreen}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-md text-sm"
            >
              Fullscreen
            </button>
          )}
          <div className="absolute bottom-4 left-4 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-1 rounded-xl">
            {displayName} (You)
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-screen text-white text-5xl font-bold bg-gradient-to-tr from-gray-800 via-cyan-800 to-gray-800 rounded-xl">
        <Avatar name={displayName} size="xl" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 p-2 overflow-y-auto">
      <div className="flex flex-1 flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0">
        <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-gray-100 relative">
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
          <div className="absolute px-3 bottom-4 left-1/2 transform -translate-x-1/2 flex flex-wrap justify-center space-x-4 bg-gray-100 bg-opacity-30 rounded-full p-1 shadow-lg">
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

        <div className="w-full md:w-80 max-h-[40vh] md:max-h-[80vh] overflow-hidden md:overflow-y-auto scrollbar-hide p-1">
          <div className="grid grid-cols-2 grid-rows-2 gap-3">
            {participants.slice(0, 4).map((participant) => (
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
      </div>

      <Drawer title="Chat" placement="right" onClose={() => setIsChatDrawerOpen(false)} open={isChatDrawerOpen} width={window.innerWidth < 600 ? 280 : 350}>
        <ChatPanel />
      </Drawer>

      <Drawer title={null} placement="right" onClose={() => setIsInfoDrawerOpen(false)} open={isInfoDrawerOpen} width={window.innerWidth < 600 ? 280 : 350} bodyStyle={{ padding: 0, height: "100%" }} closable={false}>
        <div style={{ height: "100%" }}>
          <TaskList onClose={() => setIsInfoDrawerOpen(false)} />
        </div>
      </Drawer>

      <Drawer title="Participants" placement="right" onClose={() => setParticipantsDrawerOpen(false)} open={participantsDrawerOpen} width={window.innerWidth < 600 ? 280 : 320}>
        <div className="space-y-3">
          {participants.map((participant) => (
            <div key={participant.userId} className="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded-md shadow-sm flex justify-between">
              <span>{participant.name}{participant.userId === 'local' ? ' (You)' : ''}</span>
              <span className="text-xs text-gray-500">{participant.audioEnabled ? '🎤' : '🔇'} {participant.videoEnabled ? '🎥' : '🚫'}</span>
            </div>
          ))}
        </div>
      </Drawer>

      <Modal title="Leave Meeting" open={isLeaveModalVisible} onCancel={() => setIsLeaveModalVisible(false)} footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button key="cancel" variant="outline" onClick={() => setIsLeaveModalVisible(false)}>
            Cancel
          </Button>
          <Button key="leave" variant="danger" onClick={confirmLeaveMeeting}>
            Leave
          </Button>
        </div>
      }>
        <p className="text-center mb-0">Are you sure you want to leave this meeting?</p>
      </Modal>
    </div>
  );
};

export default MeetingPage;
