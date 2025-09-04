import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Mic, MicOff, Video, VideoOff, Phone, ScreenShare, MessageSquare, MoreVertical } from 'lucide-react';

interface MeetingControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isChatOpen: boolean;
  unreadMessagesCount?: number;
  pendingServiceRequests?: number;
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
  isScreenSharing,
  isChatOpen,
  unreadMessagesCount = 0,
  pendingServiceRequests = 0,
  // participantCount,
  // meetingTime,
  // displayName,
  onToggleAudio,
  onToggleVideo,
  onToggleChat,
  onShareScreen,
  onLeaveMeeting,
  // onShowParticipants,
  onMoreOptions,
  className,
}) => {
  return (
    <div className={twMerge('flex items-center justify-center space-x-2', className)}>
      {/* Audio Control */}
      <button
        onClick={onToggleAudio}
        className={`group relative p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
          audioEnabled 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-red-500/80 hover:bg-red-500 text-white'
        }`}
      >
        {audioEnabled ? (
          <Mic size={20} className="drop-shadow-sm" />
        ) : (
          <MicOff size={20} className="drop-shadow-sm" />
        )}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            {audioEnabled ? 'Mute' : 'Unmute'}
          </div>
        </div>
      </button>
      
      {/* Video Control */}
      <button
        onClick={() => {
          console.log('Video button clicked, videoEnabled:', videoEnabled);
          onToggleVideo();
        }}
        className={`group relative p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
          videoEnabled 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-red-500/80 hover:bg-red-500 text-white'
        }`}
      >
        {videoEnabled ? (
          <Video size={20} className="drop-shadow-sm" />
        ) : (
          <VideoOff size={20} className="drop-shadow-sm" />
        )}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            {videoEnabled ? 'Stop video' : 'Start video'}
          </div>
        </div>
      </button>
      
      {/* Screen Share Control */}
      <button
        onClick={() => {
          console.log('Screen share button clicked, isScreenSharing:', isScreenSharing);
          onShareScreen();
        }}
        className={`group relative p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
          isScreenSharing 
            ? 'bg-blue-500/80 hover:bg-blue-500 text-white' 
            : 'bg-white/20 hover:bg-white/30 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            ? 'Screen sharing on mobile - tap to start'
            : isScreenSharing ? 'Stop sharing screen' : 'Share your screen'
        }
      >
        <ScreenShare size={20} className={`drop-shadow-sm ${isScreenSharing ? 'text-white' : ''}`} />
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            {isScreenSharing ? 'Stop sharing' : 'Share screen'}
          </div>
        </div>
      </button>
      
      {/* Chat Control */}
      <button
        onClick={onToggleChat}
        className={`group relative p-4 rounded-2xl transition-all duration-300 transform hover:scale-110 ${
          isChatOpen 
            ? 'bg-blue-500/80 hover:bg-blue-500 text-white' 
            : 'bg-white/20 hover:bg-white/30 text-white'
        }`}
      >
        <MessageSquare size={20} className="drop-shadow-sm" />
        {unreadMessagesCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center min-w-[24px] shadow-lg animate-pulse">
            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
          </span>
        )}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            Chat
          </div>
        </div>
      </button>
      
      {/* Leave Meeting */}
      <button
        onClick={onLeaveMeeting}
        className="group relative p-4 rounded-2xl bg-red-600/90 hover:bg-red-600 text-white transition-all duration-300 transform hover:scale-110"
      >
        <Phone size={20} className="transform rotate-135 drop-shadow-sm" />
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            Leave meeting
          </div>
        </div>
      </button>
      
      {/* More Options */}
      <button
        onClick={onMoreOptions}
        className="group relative p-4 rounded-2xl bg-white/20 hover:bg-white/30 text-white transition-all duration-300 transform hover:scale-110"
      >
        <MoreVertical size={20} className="drop-shadow-sm" />
        {pendingServiceRequests > 0 && (
          <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center min-w-[24px] shadow-lg animate-pulse">
            {pendingServiceRequests > 99 ? '99+' : pendingServiceRequests}
          </span>
        )}
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap">
            More options
          </div>
        </div>
      </button>
    </div>
  );
};

export default MeetingControls;