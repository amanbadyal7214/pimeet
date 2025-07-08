import React from 'react';
import Avatar from '../ui/Avatar';
import { Mic, VideoOff, Pin } from 'lucide-react';

interface ParticipantThumbnailProps {
  name: string;
  role: string;
  videoStream?: MediaStream;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocal?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
}

const ParticipantThumbnail: React.FC<ParticipantThumbnailProps> = ({
  name,
  role,
  videoStream,
  videoEnabled,
  audioEnabled,
  isLocal = false,
  onPin,
  isPinned = false,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(() => {});
    }
  }, [videoStream]);

  return (
    <div className={`relative bg-gray-800 rounded-xl overflow-hidden shadow-lg w-36 h-48 flex flex-col justify-end p-3 ${isPinned ? 'ring-4 ring-blue-500' : ''}`}>
      {videoEnabled && videoStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover rounded-xl"
        />
      ) : (
        <div className="absolute inset-0 bg-blue-700 flex items-center justify-center rounded-xl">
          <Avatar name={name} size="lg" />
        </div>
      )}
      <div className="relative z-10 text-white">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-semibold">{name}{isLocal ? ' (You)' : ''}</div>
            <div className="text-xs text-gray-300">{role}</div>
          </div>
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
        <div className="flex space-x-2 mt-1">
          {!audioEnabled && <Mic className="w-4 h-4 text-red-500" />}
          {!videoEnabled && <VideoOff className="w-4 h-4 text-red-500" />}
        </div>
      </div>
    </div>
  );
};

export default ParticipantThumbnail;
