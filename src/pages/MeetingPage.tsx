import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import MeetingControls from '../components/meeting/MeetingControls';
import ChatPanel from '../components/meeting/ChatPanel';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { formatTime } from '../utils/meeting';
import { useWebRTC } from '../hooks/useWebRTC';
import ParticipantThumbnail from '../components/meeting/ParticipantThumbnail';
import TaskList from '../components/meeting/TaskList';
import Avatar from '../components/ui/Avatar';

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as { creatorName?: string; meetingTitle?: string };
  const displayName = state?.creatorName || searchParams.get('name') || 'Guest';
  const title = state?.meetingTitle || 'Untitled Meeting';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
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
    const interval = setInterval(() => {
      setMeetingTime((prev) => prev + 1);
    }, 1000);
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
    const pinned = participants.find((p) => p.userId === pinnedParticipantId);
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
  const handleToggleChat = () => setIsChatOpen(!isChatOpen);
  const handleShowTasks = () => setShowTasks(!showTasks);
  const handleShareScreen = async () => {
    try {
      await startScreenShare();
    } catch (err) {
      console.error('Screen share failed', err);
    }
  };

  const confirmLeaveMeeting = () => navigate('/');
  const handleLeaveMeeting = () => setShowConfirmLeave(true);
  const handleShowParticipants = () => setShowParticipantsModal(true);
  const handlePinParticipant = (userId: string) => {
    setPinnedParticipantId(userId === pinnedParticipantId ? null : userId);
  };

  const renderMainView = () => {
    const pinned = participants.find((p) => p.userId === pinnedParticipantId);

    if (pinned) {
      if (pinned.videoEnabled && pinned.stream) {
        return (
          <div className="relative w-full h-full">
            <video
              ref={pinnedVideoRef}
              autoPlay
              muted={pinned.userId === 'local'}
              playsInline
              className="w-full h-full object-cover rounded-xl"
            />
            <div className="absolute bottom-4 left-4 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-1 rounded-xl">
              {pinned.name} {pinned.userId === 'local' ? '(You)' : ''}
            </div>
          </div>
        );
      } else {
        return (
          <div className="flex items-center justify-center h-full text-white text-5xl font-bold bg-blue-400 rounded-xl">
            <Avatar name={pinned.name} size="xl" />
          </div>
        );
      }
    }

    if (localStream && localVideoEnabled) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover rounded-xl"
          />
          <div className="absolute bottom-4 left-4 text-white text-lg font-semibold bg-black bg-opacity-50 px-4 py-1 rounded-xl">
            {displayName} (You)
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-white text-5xl font-bold bg-blue-400 rounded-xl">
        <Avatar name={displayName} size="xl" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-800 p-2 fixed top-0 left-0 right-0">
      {/* Info Icon with Title Hover */}
      <div className="absolute top-4 right-4 z-50 group">
        <div className="flex items-center space-x-2 cursor-pointer">
          <div className="bg-slate-400 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-300 group-hover:w-48 group-hover:rounded-full group-hover:justify-start px-2 bg-opacity-70 overflow-hidden">
            <span className="ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {title}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden relative">
        {/* Chat Panel */}
        {isChatOpen && (
          <div className="absolute top-4 left-4 w-96 h-[80vh] z-50 bg-white rounded-xl shadow-lg flex flex-col overflow-hidden border border-gray-200">
            <div className="flex justify-between items-center bg-gray-100 px-4 py-2 border-b border-gray-300">
              <h2 className="text-md font-semibold text-gray-800">Chat</h2>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-red-600 text-xl">×</button>
            </div>
            <div className="flex-1 overflow-auto">
              <ChatPanel />
            </div>
          </div>
        )}

        {/* Task List */}
        {showTasks && (
          <div className="absolute top-4 left-4 w-80 h-[80vh] z-50">
            <TaskList onClose={() => setShowTasks(false)} />
          </div>
        )}

        {/* Participants */}
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

        {/* Participants Modal */}
        <Modal isOpen={showParticipantsModal} onClose={() => setShowParticipantsModal(false)} title="Participants">
          <div className="max-h-[300px] overflow-y-auto px-4 py-2 space-y-2">
            {participants.map((participant) => (
              <div key={participant.userId} className="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded-md shadow-sm flex justify-between">
                <span>{participant.name}{participant.userId === 'local' ? ' (You)' : ''}</span>
                <span className="text-xs text-gray-500">{participant.audioEnabled ? '🎤' : '🔇'} {participant.videoEnabled ? '🎥' : '🚫'}</span>
              </div>
            ))}
          </div>
        </Modal>

        {/* Main Video View */}
        <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-gray-100 shadow-lg relative">
          {renderMainView()}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4 bg-black bg-opacity-30 rounded-full p-1 shadow-lg">
            <MeetingControls
              audioEnabled={localAudioEnabled}
              videoEnabled={localVideoEnabled}
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
              onMoreOptions={handleShowTasks}
              className="flex-row space-x-4 bg-transparent shadow-none p-0"
            />
          </div>
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      <Modal isOpen={showConfirmLeave} onClose={() => setShowConfirmLeave(false)} title="Leave Meeting">
        <div className="text-center">
          <p className="mb-4">Are you sure you want to leave this meeting?</p>
          <div className="flex space-x-3 justify-center">
            <Button variant="outline" onClick={() => setShowConfirmLeave(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmLeaveMeeting}>Leave</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingPage;
