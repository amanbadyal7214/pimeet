// Extend window type for global trainer flag
declare global {
  interface Window {
    __PI_MEET_IS_TRAINER?: boolean;
  }
}
import React from 'react';
import Avatar from '../ui/Avatar';
import { MicOff, VideoOff, Pin, Monitor } from 'lucide-react';

interface ParticipantThumbnailProps {
  name: string;
  role: string;
  videoStream?: MediaStream;
  screenShareStream?: MediaStream;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isScreenSharing?: boolean;
  isLocal?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
}

const ParticipantThumbnail: React.FC<ParticipantThumbnailProps> = ({
  name,
  role,
  videoStream,
  screenShareStream,
  videoEnabled,
  audioEnabled,
  isScreenSharing = false,
  isLocal = false,
  onPin,
  isPinned = false,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const screenShareRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    if (videoRef.current) {
      if (videoEnabled && videoStream) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [videoStream, videoEnabled]);

  // Screen share effect
  React.useEffect(() => {
    if (screenShareRef.current) {
      if (isScreenSharing && screenShareStream) {
        screenShareRef.current.srcObject = screenShareStream;
        screenShareRef.current.play().catch(() => {});
      } else {
        screenShareRef.current.srcObject = null;
      }
    }
  }, [screenShareStream, isScreenSharing]);

  React.useEffect(() => {
    if (audioRef.current) {
      if (audioEnabled && videoStream) {
        audioRef.current.srcObject = videoStream;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.srcObject = null;
      }
    }
  }, [videoStream, audioEnabled]);

  return (
    <div
      className={`relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl overflow-hidden shadow-lg w-full aspect-video flex flex-col justify-end border transition-all duration-200 hover:scale-[1.02] ${
        isPinned ? 'ring-2 ring-blue-400/60 shadow-blue-400/20' : 'border-white/20 hover:border-white/40'
      }`}
    >
      {/* Video or Screen Share or Avatar */}
      {isLocal && isScreenSharing && screenShareStream ? (
        // Local screen share - use dedicated screenShareStream, no mirror effect
        <video
          ref={screenShareRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-contain rounded-xl bg-black"
        />
      ) : videoEnabled && videoStream ? (
        // Regular video (camera) OR remote screen share
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`absolute inset-0 w-full h-full ${
            isScreenSharing 
              ? 'object-contain bg-black' 
              : 'object-cover scale-x-[-1]'
          } rounded-xl`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/40 via-blue-600/40 to-cyan-600/40 flex items-center justify-center rounded-xl backdrop-blur-sm">
          <Avatar name={name} size="md" />
        </div>
      )}

      {/* Audio element for audio playback */}
      <audio ref={audioRef} autoPlay muted={isLocal || !audioEnabled} />

      {/* Enhanced Footer Overlay - More compact */}
      <div className="relative z-10 p-2 bg-gradient-to-t from-black/90 via-black/70 to-transparent rounded-b-xl">
        <div className="flex justify-between items-end">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 mb-1">
              <div className="font-medium text-white text-xs truncate">
                {/* Always show just name, not ID */}
                {(() => {
                  const match = name.match(/^(.*) \((\d+)\)$/);
                  return (match ? match[1] : name) + (isLocal ? ' (You)' : '');
                })()}
              </div>
              {isScreenSharing && (
                <span className="text-xs bg-blue-500/90 text-white px-1.5 py-0.5 rounded-full flex items-center space-x-1 backdrop-blur-sm">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <span>Screen</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/70 font-medium">
                {role === 'trainer' ? '👨‍🏫 Trainer' : role}
              </div>
              
              {/* Status indicators - More compact */}
              <div className="flex items-center space-x-1">
                {!audioEnabled && (
                  <div className="p-1 bg-red-500/80 rounded-full backdrop-blur-sm">
                    <MicOff className="w-2.5 h-2.5 text-white" aria-label="Mic Off" />
                  </div>
                )}
                {!videoEnabled && (
                  <div className="p-1 bg-red-500/80 rounded-full backdrop-blur-sm">
                    <VideoOff className="w-2.5 h-2.5 text-white" aria-label="Video Off" />
                  </div>
                )}
                {isScreenSharing && (
                  <div className="p-1 bg-blue-500/80 rounded-full backdrop-blur-sm">
                    <Monitor className="w-2.5 h-2.5 text-white" aria-label="Screen Sharing" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pin Button - More compact */}
          {onPin && (
            <button
              onClick={onPin}
              className={`ml-2 p-1.5 rounded-full transition-all duration-200 backdrop-blur-sm ${
                isPinned 
                  ? 'bg-blue-500/80 text-white hover:bg-blue-600/80' 
                  : 'bg-white/20 text-white/80 hover:bg-white/30 hover:text-white'
              }`}
              title={isPinned ? 'Unpin' : 'Pin to main view'}
              type="button"
            >
              <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParticipantThumbnail;
