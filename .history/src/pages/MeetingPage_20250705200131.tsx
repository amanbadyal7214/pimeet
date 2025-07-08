import React, { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
/* Removed unused imports to clean up code */
import { useWebRTC } from '../hooks/useWebRTC';

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const displayName = searchParams.get('name') || 'Guest';
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const {
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    toggleAudio,
    toggleVideo,
    startScreenShare,
  } = useWebRTC(meetingId ?? '');

  const [hostUserId, setHostUserId] = React.useState<string | null>(null);
  const [spotlightUserId, setSpotlightUserId] = React.useState<string | null>(null);
console.log('MeetingPage rendered with meetingId:', spotlightUserId);
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

  // Removed useEffect for meetingTime and beforeunload as related state was removed

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Assigning localStream to localVideoRef');
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      const videoElement = remoteVideoRefs.current.get(userId);
      if (videoElement) {
        if (videoElement.srcObject !== stream) {
          console.log(`Assigning remote stream to video element for userId: ${userId}`);
          videoElement.srcObject = stream;
          videoElement.onloadedmetadata = () => {
            videoElement.play().catch((error) => {
              console.error('Error playing remote video for user:', userId, error);
            });
          };
        }
      } else {
        console.warn(`No video element found for userId: ${userId}`);
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

  // Removed unused handleToggleChat and handleShareScreen functions

  // Removed unused handleLeaveMeeting function as onClick now directly sets showConfirmLeave
  // Removed unused confirmLeaveMeeting and handleShowParticipants functions

  const renderParticipantVideo = (stream: MediaStream, userId: string, displayName: string, role: string, isLocal: boolean = false) => {
    const videoRef = isLocal ? localVideoRef : (el: HTMLVideoElement | null) => {
      if (el) {
        remoteVideoRefs.current.set(userId, el);
      } else {
        remoteVideoRefs.current.delete(userId);
      }
    };

    const videoTracks = stream.getVideoTracks();
    const videoEnabledForUser = videoTracks.length > 0 && videoTracks.some(track => track.enabled);

    return (
      <div className="relative rounded-lg overflow-hidden shadow-lg cursor-pointer bg-gray-800">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-48 object-cover ${!videoEnabledForUser ? 'hidden' : ''}`}
        />
        {!videoEnabledForUser && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 text-white text-sm">
          <div>{displayName}{isLocal ? ' (You)' : ''}</div>
          <div className="text-xs opacity-75">{role}</div>
        </div>
        <div className="absolute top-2 right-2 flex space-x-2">
          {/* Mute and video icons can be added here */}
          {/* For example, use lucide-react icons */}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-blue-900 p-4 gap-4">
      <div className="flex flex-1 gap-4">
        <div className="flex flex-col w-1/3 gap-4 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            {localStream && renderParticipantVideo(localStream, 'local', displayName, 'You', true)}
            {Array.from(remoteUserDisplayNames).map(([userId, name]) => {
              const stream = remoteStreams.get(userId);
              if (!stream) return null;
              return renderParticipantVideo(stream, userId, name, 'Participant');
            })}
          </div>
          <div className="bg-blue-800 rounded-lg p-4 text-white">
            <h3 className="font-semibold mb-2">Daily Task</h3>
            <ul className="space-y-2 text-sm">
              <li className="line-through opacity-50">Meeting scheduled for next Friday</li>
              <li><input type="checkbox" className="mr-2" />Prepare Style Guide</li>
              <li><input type="checkbox" className="mr-2" />Share Design feedback to Kate</li>
              <li><input type="checkbox" className="mr-2" />Call Adams for discussion</li>
              <li><input type="checkbox" className="mr-2" />Interview scheduled for Jr. Designers</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col flex-1 rounded-lg bg-gray-100 p-4">
          <div className="relative flex-1 rounded-lg overflow-hidden bg-black">
            {spotlightUserId === 'local' ? (
              localStream && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              )
            ) : (
            spotlightUserId === 'local' ? (
              <video
                ref={(el) => {
                  if (el && spotlightUserId) {
                    remoteVideoRefs.current.set(spotlightUserId, el);
                  } else if (el === null && spotlightUserId) {
                    remoteVideoRefs.current.delete(spotlightUserId);
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : null)
            }
            <div className="absolute bottom-4 left-4 z-20 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">
              {spotlightUserId === 'local' ? displayName + ' (You)' : remoteUserDisplayNames.get(spotlightUserId) || 'Unknown'}
              {spotlightUserId === hostUserId && ' (Host)'}
            </div>
            <div className="absolute top-4 right-4 flex space-x-4 z-20">
              {/* Actual video conferencing controls */}
              <button
                className="bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
                onClick={handleToggleAudio}
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v11m0 0a3 3 0 003-3m-3 3a3 3 0 01-3-3m3 3v7m-4 4h8" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 00-3-3v6a3 3 0 003-3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.07 4.93a10 10 0 00-14.14 14.14" />
                  </svg>
                )}
              </button>
              <button
                className="bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75"
                onClick={handleToggleVideo}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  </svg>
                )}
              </button>
              <button
                className="bg-red-600 rounded-full p-2 hover:bg-red-700"
                onClick={() => setShowConfirmLeave(true)}
                title="Leave meeting"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-4 bg-gray-100 rounded-lg p-4 text-gray-800">
            <p>Hello Guys, Thanks to all who have joined this video Conference. Hope you guys are fit and enjoying! We have to redesign our website with the motive of having good User Experience. We’ll do some basic research and then prepare a Style guide</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingPage;

