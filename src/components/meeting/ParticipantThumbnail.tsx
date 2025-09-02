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
      className={`relative bg-gray-800 rounded-xl overflow-hidden shadow-lg w-36 h-48 flex flex-col justify-end p-3 ${
        isPinned ? 'ring-4 ring-neutral-300' : ''
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
          className="absolute inset-0 w-full h-full object-contain rounded-xl bg-gray-900"
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
              ? 'object-contain bg-gray-900' 
              : 'object-cover scale-x-[-1]'
          } rounded-xl`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-tr from-gray-800 via-cyan-800 to-gray-800 flex items-center justify-center rounded-xl">
          <Avatar name={name} size="lg" />
        </div>
      )}

      {/* Audio element for audio playback */}
      <audio ref={audioRef} autoPlay muted={isLocal || !audioEnabled} />

      {/* Footer Overlay */}
      <div className="relative z-10 text-white">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold">
              {/* Hamesha sirf name dikhaye, ID na dikhaye */}
              {(() => {
                const match = name.match(/^(.*) \((\d+)\)$/);
                return (match ? match[1] : name) + (isLocal ? ' (You)' : '');
              })()}
              {isScreenSharing && (
                <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded-full">
                  Screen
                </span>
              )}
            </div>
            <div className="text-xs text-gray-300">{role}</div>
          </div>

          {/* Pin Button */}
          {onPin && (
            <button
              onClick={onPin}
              className="ml-2 p-1 rounded-full hover:bg-gray-700"
              title={isPinned ? 'Unpin' : 'Pin'}
              type="button"
            >
              <Pin className={`w-5 h-5 ${isPinned ? 'text-blue-400' : 'text-gray-400'}`} />
            </button>
          )}
        </div>

        {/* Mic & Camera Status */}
        <div className="flex space-x-2 mt-1">
          {!audioEnabled && <MicOff className="w-4 h-4 text-red-500" aria-label="Mic Off" />}
          {!videoEnabled && <VideoOff className="w-4 h-4 text-red-500" aria-label="Video Off" />}
          {isScreenSharing && <Monitor className="w-4 h-4 text-blue-400" aria-label="Screen Sharing" />}
        </div>
      </div>
    </div>
  );
};

export default ParticipantThumbnail;
