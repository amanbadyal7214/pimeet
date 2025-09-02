"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import MeetingControls from "../components/meeting/MeetingControls";
import ChatPanel from "../components/meeting/ChatPanel";
import Button from "../components/ui/Button";
import { formatTime } from "../utils/meeting";
import { useWebRTC } from "../hooks/useWebRTC";
import ParticipantThumbnail from "../components/meeting/ParticipantThumbnail";
import TaskList from "../components/meeting/TaskList";
import Avatar from "../components/ui/Avatar";
import { Drawer, Modal } from "antd";
import { SocketService } from "../services/socket";

const MeetingPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as {
    creatorName?: string;
    meetingTitle?: string;
  };
  const displayName =
    state?.creatorName || searchParams.get("name") || "Guest";
  const studentId = searchParams.get("id") || "";
  const title = state?.meetingTitle || meetingId || "Untitled Meeting";

  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [participantsDrawerOpen, setParticipantsDrawerOpen] = useState(false);
  const [isLeaveModalVisible, setIsLeaveModalVisible] = useState(false);
  const [meetingTime, setMeetingTime] = useState(0);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<
    string | null
  >(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  // Chat-related state
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);


  const pinnedVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const socketUrl = "http://localhost:3001"; // Adjust if needed
    SocketService.getInstance().connect(socketUrl);
  }, []);

  // Handle incoming chat messages at the meeting page level
  useEffect(() => {
    const socket = SocketService.getInstance().getSocket();
    if (!socket) return;

    const handleIncomingMessage = (payload: any) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: payload.sender, text: payload.message, timestamp: payload.timestamp },
      ]);
      
      // Only increment unread count if chat drawer is not open
      if (!isChatDrawerOpen) {
        setUnreadMessagesCount((prev) => prev + 1);
      }
    };

    socket.on('chat-message', handleIncomingMessage);

    return () => {
      socket.off('chat-message', handleIncomingMessage);
    };
  }, [isChatDrawerOpen]);

  const {
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    remoteUserStatus,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    localAudioEnabled,
    localVideoEnabled,
    screenShareStream,
    isLocalScreenSharing,
  } = useWebRTC(meetingId || "");

  const isMobile =
    typeof window !== "undefined" && window.innerWidth <= 768;

  useEffect(() => {
    const interval = setInterval(
      () => setMeetingTime((prev) => prev + 1),
      1000
    );
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Set global flag for trainer
    if (typeof window !== "undefined") {
      (window as any).__PI_MEET_IS_TRAINER = studentId === "trainer";
    }
    const updated = [
      {
        userId: "local",
        name: studentId ? `${displayName} (${studentId})` : displayName,
        role: studentId === "trainer" ? "trainer" : "You",
        audioEnabled: localAudioEnabled,
        videoEnabled: localVideoEnabled,
        stream: localStream || undefined,
        isScreenSharing: isLocalScreenSharing,
        screenShareStream: screenShareStream || undefined,
      },
    ];

    const isTrainer = studentId === "trainer";
    remoteUserDisplayNames.forEach((name, userId) => {
      let display = name;
      let id = "";
      const match = name.match(/^(.*) \((\d+)\)$/);
      if (match) {
        display = match[1];
        id = match[2];
      }
      const status =
        remoteUserStatus.get(userId) || {
          audioEnabled: true,
          videoEnabled: true,
          isScreenSharing: false,
        };
      updated.push({
        userId,
        name: isTrainer && id ? `${display} (${id})` : display,
        role: "Participant",
        audioEnabled: status.audioEnabled,
        videoEnabled: status.videoEnabled,
        stream: remoteStreams.get(userId),
        isScreenSharing: status.isScreenSharing,
        screenShareStream: status.isScreenSharing ? remoteStreams.get(userId) : undefined,
      });
    });

    // Move trainer to the top if present
    const trainerIndex = updated.findIndex((p) => p.role === "trainer");
    if (trainerIndex > 0) {
      const [trainer] = updated.splice(trainerIndex, 1);
      updated.unshift(trainer);
    }
    setParticipants(updated);
  }, [
    localStream,
    remoteStreams,
    remoteUserDisplayNames,
    remoteUserStatus,
    localAudioEnabled,
    localVideoEnabled,
    screenShareStream,
    isLocalScreenSharing,
  ]);

  // Detect new participant join and open chat drawer (only for trainer)
  const prevParticipantsCountRef = React.useRef(participants.length);

  useEffect(() => {
    // Only open chat automatically for trainer when new participant joins
    if (participants.length > prevParticipantsCountRef.current && studentId === "trainer") {
      setIsChatDrawerOpen(true);
    }
    prevParticipantsCountRef.current = participants.length;
  }, [participants, studentId]);

  useEffect(() => {
    const pinned = participants.find(
      (p) => p.userId === pinnedParticipantId
    );
    if (pinned?.videoEnabled && pinned?.stream && pinnedVideoRef.current) {
      pinnedVideoRef.current.srcObject = pinned.stream;
    }
  }, [pinnedParticipantId, participants]);

  useEffect(() => {
    console.log('localStream useEffect triggered');
    console.log('localStream:', localStream);
    console.log('localVideoRef.current:', localVideoRef.current);
    console.log('localVideoEnabled:', localVideoEnabled);
    
    if (localStream && localVideoRef.current) {
      console.log('Setting localVideoRef.srcObject to localStream');
      console.log('localStream tracks:', localStream.getTracks().map(t => t.kind + ':' + t.label));
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(error => {
        console.error('Failed to play local video:', error);
      });
    } else {
      console.log('Not setting video - missing localStream or ref');
    }
  }, [localStream, localVideoEnabled]);

  useEffect(() => {
    if (screenShareStream && screenShareRef.current) {
      screenShareRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream]);

  const enterFullscreen = () => {
    const el = pinnedVideoRef.current || localVideoRef.current;
    if (el?.requestFullscreen) el.requestFullscreen();
    else if ((el as any)?.webkitRequestFullscreen)
      (el as any).webkitRequestFullscreen();
    else if ((el as any)?.msRequestFullscreen)
      (el as any).msRequestFullscreen();
  };

  const handleToggleAudio = async () =>
    await toggleAudio(!localAudioEnabled);
  const handleToggleVideo = async () =>
    await toggleVideo(!localVideoEnabled);

  const handleShareScreen = async () => {
    try {
      console.log('handleShareScreen called, isLocalScreenSharing:', isLocalScreenSharing);
      if (!isLocalScreenSharing) {
        console.log('Starting screen share...');
        await startScreenShare();
      } else {
        console.log('Stopping screen share...');
        await stopScreenShare();
      }
    } catch (err) {
      console.error("Screen share failed", err);
    }
  };

  // ✅ Leave redirect logic
  const confirmLeaveMeeting = () => {
    if (studentId === "trainer") {
      window.location.href =
        "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
    } else if (studentId) {
      window.location.href =
        "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
    } else {
      navigate("/"); // fallback for guests without ID
    }
  };

  const handleLeaveMeeting = () => setIsLeaveModalVisible(true);
  const handleShowParticipants = () => setParticipantsDrawerOpen(true);
  const handleShowChat = () => {
    setIsChatDrawerOpen(true);
    setUnreadMessagesCount(0); // Reset unread count when opening chat
  };

  const handleSendMessage = (message: string) => {
    const socket = SocketService.getInstance().getSocket();
    if (socket) {
      socket.emit('chat-message', {
        roomId: meetingId,
        message,
        sender: displayName,
        timestamp: Date.now(),
      });
    }
  };
  const handleShowInfo = () => setIsInfoDrawerOpen(true);

  const handlePinParticipant = (userId: string) => {
    setPinnedParticipantId(userId === pinnedParticipantId ? null : userId);
  };

  // ✅ Attendance API
// ✅ Attendance API
const markAttendance = async () => {
  const ids = participants
    .filter(
      (p) =>
        p.userId !== "local" &&
        p.name &&
        p.name.indexOf("(trainer)") === -1 &&
        p.role !== "trainer"
    )
    .map((p) => {
      const match = p.name.match(/\(([^)]+)\)$/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  if (ids.length > 0) {
    const today = new Date();
    // ✅ Correct format: yyyy-mm-dd
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const payload = ids.map((id) => ({
      studentId: id,
      date: formattedDate,
    }));
    console.log("Attendance Payload:", payload);

    try {
      const response = await fetch(
        "https://project.pisofterp.com/pipl/restworld/markAttendance",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        alert("✅ Attendance marked successfully!");
      } else {
        const errorText = await response.text();
        alert("❌ Failed: " + errorText);
      }
    } catch (err) {
      console.error("Attendance API error:", err);
      alert("❌ Error marking attendance.");
    }
  } else {
    alert("No participant IDs found.");
  }
};

  const screenShareRef = useRef<HTMLVideoElement | null>(null);

  const renderMainView = () => {
    // First priority: Show pinned participant
    const pinned = participants.find(
      (p) => p.userId === pinnedParticipantId
    );

    if (pinned?.videoEnabled && pinned?.stream) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={pinnedVideoRef}
            autoPlay
            muted={pinned.userId === "local"}
            playsInline
            className={`w-full h-screen ${pinned.isScreenSharing ? 'object-contain bg-gray-900' : 'object-cover scale-x-[-1]'} rounded-xl`}
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
            {pinned.name} {pinned.userId === "local" ? "(You)" : ""} {pinned.isScreenSharing ? "(Screen Share)" : ""}
          </div>
        </div>
      );
    }

    // Second priority: Show screen share if active
    if (screenShareStream) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={screenShareRef}
            autoPlay
            playsInline
            className="w-full h-screen object-contain rounded-xl bg-gray-900"
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
            Screen Share
          </div>
        </div>
      );
    }

    // Third priority: Show local video if enabled
    if (localStream && localVideoEnabled) {
      return (
        <div className="relative w-full h-full">
          <video
            ref={localVideoRef}
            autoPlay
            muted
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
            {displayName} (You)
          </div>
        </div>
      );
    }

    // Fallback: Show avatar
    return (
      <div className="flex items-center justify-center h-screen text-white text-5xl font-bold bg-gradient-to-tr from-gray-800 via-cyan-800 to-gray-800 rounded-xl">
        <Avatar name={displayName} size="lg" />
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
                <span className="ml-2 whitespace-nowrap font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
              isScreenSharing={isLocalScreenSharing}
              isChatOpen={isChatDrawerOpen}
              unreadMessagesCount={unreadMessagesCount}
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

        <div className="w-full md:w-80 max-h-[40vh] md:max-h-[80vh] p-1">
          {/* Small screen: horizontal scroll */}
          <div className="md:hidden flex space-x-3 overflow-x-auto scrollbar-hide">
            {[...participants]
              .sort((a, b) =>
                a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
              )
              .map((participant) => (
                <div
                  key={participant.userId}
                  className="flex-shrink-0 w-40"
                >
                  <ParticipantThumbnail
                    name={participant.name}
                    role={participant.role}
                    videoStream={participant.stream}
                    screenShareStream={participant.screenShareStream}
                    videoEnabled={participant.videoEnabled}
                    audioEnabled={participant.audioEnabled}
                    isScreenSharing={participant.isScreenSharing}
                    isLocal={participant.userId === "local"}
                    onPin={() =>
                      handlePinParticipant(participant.userId)
                    }
                    isPinned={
                      pinnedParticipantId === participant.userId
                    }
                  />
                </div>
              ))}
          </div>

          {/* Medium and larger screen: grid layout */}
          <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-3">
            {[...participants]
              .sort((a, b) =>
                a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
              )
              .slice(0, 4)
              .map((participant) => (
                <ParticipantThumbnail
                  key={participant.userId}
                  name={participant.name}
                  role={participant.role}
                  videoStream={participant.stream}
                  screenShareStream={participant.screenShareStream}
                  videoEnabled={participant.videoEnabled}
                  audioEnabled={participant.audioEnabled}
                  isScreenSharing={participant.isScreenSharing}
                  isLocal={participant.userId === "local"}
                  onPin={() =>
                    handlePinParticipant(participant.userId)
                  }
                  isPinned={
                    pinnedParticipantId === participant.userId
                  }
                />
              ))}
          </div>
        </div>
      </div>

      {/* Chat Drawer */}
      <Drawer
        title="Chat"
        placement="right"
        onClose={() => setIsChatDrawerOpen(false)}
        open={isChatDrawerOpen}
        width={window.innerWidth < 600 ? 280 : 350}
      >
        <ChatPanel 
          sender={displayName} 
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </Drawer>

      {/* Info Drawer */}
      <Drawer
        title={null}
        placement="right"
        onClose={() => setIsInfoDrawerOpen(false)}
        open={isInfoDrawerOpen}
        width={window.innerWidth < 600 ? 280 : 350}
        bodyStyle={{ padding: 0, height: "100%" }}
        closable={false}
      >
        <div style={{ height: "100%" }}>
          <TaskList onClose={() => setIsInfoDrawerOpen(false)} />
        </div>
      </Drawer>

      {/* Participants Drawer */}
    {/* Participants Drawer */}
<Drawer
  title="Participants"
  placement="right"
  onClose={() => setParticipantsDrawerOpen(false)}
  open={participantsDrawerOpen}
  width={window.innerWidth < 600 ? 280 : 320}
>
  <div className="space-y-3">
    {/* ✅ Select All Checkbox */}
    {participants.find((p) => p.userId === "local")?.role === "trainer" && (
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          checked={
            participants
              .filter((p) => p.userId !== "local" && p.role !== "trainer")
              .every((p) => selectedParticipants.includes(p.userId)) &&
            participants.filter((p) => p.userId !== "local" && p.role !== "trainer").length > 0
          }
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedParticipants(
                participants
                  .filter((p) => p.userId !== "local" && p.role !== "trainer")
                  .map((p) => p.userId)
              );
            } else {
              setSelectedParticipants([]);
            }
          }}
          className="mr-2"
        />
        <span className="text-gray-700 font-medium">Select All</span>
      </div>
    )}

    {/* ✅ Individual Participants */}
    {[...participants]
      .sort((a, b) =>
        a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
      )
      .map((participant) => (
        <div
          key={participant.userId}
          className="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded-md shadow-sm flex justify-between items-center"
        >
          <div className="flex items-center space-x-2">
            {/* Show checkboxes only for trainer view */}
            {participants.find((p) => p.userId === "local")?.role ===
              "trainer" &&
              participant.role !== "trainer" && (
                <input
                  type="checkbox"
                  checked={selectedParticipants.includes(participant.userId)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedParticipants([
                        ...selectedParticipants,
                        participant.userId,
                      ]);
                    } else {
                      setSelectedParticipants(
                        selectedParticipants.filter(
                          (id) => id !== participant.userId
                        )
                      );
                    }
                  }}
                  className="mr-2"
                />
              )}
            <span>
              {(() => {
                const match = participant.name.match(/^(.*) \((\d+)\)$/);
                return (
                  (match ? match[1] : participant.name) +
                  (participant.userId === "local" ? " (You)" : "")
                );
              })()}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {participant.audioEnabled ? "🎤" : "🔇"}{" "}
            {participant.videoEnabled ? "🎥" : "🚫"}
          </span>
        </div>
      ))}

    {/* ✅ Attendance Button (Trainer only) */}
    {participants.find((p) => p.userId === "local")?.role === "trainer" && (
      <div className="mt-4">
        <button
          className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          onClick={markAttendance}
        >
          Mark Attendance
        </button>
      </div>
    )}
  </div>
</Drawer>


      {/* Leave Meeting Modal */}
      <Modal
        title="Leave Meeting"
        open={isLeaveModalVisible}
        onCancel={() => setIsLeaveModalVisible(false)}
        footer={
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
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
        <p className="text-center mb-0">
          Are you sure you want to leave this meeting?
        </p>
      </Modal>
    </div>
  );
};

export default MeetingPage;
