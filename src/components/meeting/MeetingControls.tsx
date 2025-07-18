import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Mic, MicOff, Video, VideoOff, Phone, ScreenShare, MessageSquare, MoreVertical, Users } from 'lucide-react';

interface MeetingControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isChatOpen: boolean;
  participantCount: number;
  meetingTime: string;
  displayName?: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleChat: () => void;
  onShareScreen: () => void;
  onLeaveMeeting: () => void;
  onShowParticipants: () => void;
  onMoreOptions: () => void;
  className?: string;
}

const MeetingControls: React.FC<MeetingControlsProps> = ({
  audioEnabled,
  videoEnabled,
  isChatOpen,
  participantCount,
  meetingTime,
  displayName,
  onToggleAudio,
  onToggleVideo,
  onToggleChat,
  onShareScreen,
  onLeaveMeeting,
  onShowParticipants,
  onMoreOptions,
  className,
}) => {
  return (
    <div className={twMerge('flex flex-col items-center bg-white rounded-t-lg shadow-lg p-3', className)}>
      <div className="flex  items-center justify-between w-full mb-2">
        <div className="text-sm text-black">{meetingTime}</div>
        <button 
          onClick={onShowParticipants}
          className="flex items-center text-sm text-black hover:text-blue-600"
        >
          <Users size={16} className="mr-1" />
          <span>{participantCount}</span>
        </button>
      </div>
      {displayName && (
        <div className="text-sm text-black mb-2 w-full text-center font-semibold">
          You: {displayName}
        </div>
      )}
      <div className="flex items-center justify-center space-x-2 w-full">
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-full ${
            audioEnabled ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
        >
          {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-full ${
            videoEnabled ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-200'
          }`}
        >
          {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        
        <button
          onClick={onShareScreen}
          className="p-3 rounded-full bg-gray-200 hover:bg-gray-300"
        >
          <ScreenShare size={20} />
        </button>
        
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-full ${
            isChatOpen ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          <MessageSquare size={20} />
        </button>
        
        <button
          onClick={onLeaveMeeting}
          className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700"
        >
          <Phone size={20} className="transform rotate-135" />
        </button>
        
        <button
          onClick={onMoreOptions}
          className="p-3 rounded-full bg-gray-200 hover:bg-gray-300"
        >
          <MoreVertical size={20} />
        </button>
      </div>
    </div>
  );
};

export default MeetingControls;