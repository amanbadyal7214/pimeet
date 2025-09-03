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
        <div className="relative w-full h-full group">
          <video
            ref={pinnedVideoRef}
            autoPlay
            muted={pinned.userId === "local"}
            playsInline
            className={`w-full h-full ${pinned.isScreenSharing ? 'object-contain bg-black' : 'object-cover scale-x-[-1]'} rounded-2xl`}
          />
          {isMobile && (
            <button
              onClick={enterFullscreen}
              className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>
          )}
          <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-2xl">
            <div className="font-semibold text-lg">
              {pinned.name} {pinned.userId === "local" ? "(You)" : ""}
            </div>
            {pinned.isScreenSharing && (
              <div className="text-sm text-blue-200 flex items-center mt-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                Screen Share Active
              </div>
            )}
          </div>
        </div>
      );
    }

    // Second priority: Show screen share if active
    if (screenShareStream) {
      return (
        <div className="relative w-full h-full group">
          <video
            ref={screenShareRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain rounded-2xl bg-black"
          />
          {isMobile && (
            <button
              onClick={enterFullscreen}
              className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>
          )}
          <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-2xl">
            <div className="font-semibold text-lg flex items-center">
              <div className="w-3 h-3 bg-blue-400 rounded-full mr-3 animate-pulse"></div>
              Screen Share
            </div>
          </div>
        </div>
      );
    }

    // Third priority: Show local video if enabled
    if (localStream && localVideoEnabled) {
      return (
        <div className="relative w-full h-full group">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover rounded-2xl scale-x-[-1]"
          />
          {isMobile && (
            <button
              onClick={enterFullscreen}
              className="absolute top-6 right-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70"
            >
              <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </button>
          )}
          <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-2xl">
            <div className="font-semibold text-lg">{displayName} (You)</div>
          </div>
        </div>
      );
    }

    // Fallback: Show avatar with beautiful gradient
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-900/30 via-blue-900/30 to-cyan-900/30 rounded-2xl backdrop-blur-sm">
        <div className="text-center">
          <div className="mb-6">
            <Avatar name={displayName} size="lg" />
          </div>
          <div className="text-white text-2xl font-bold mb-2">{displayName}</div>
          <div className="text-white/70 text-lg">Camera is off</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 p-3 overflow-hidden">
      {/* Meeting Header */}
      <div className="flex items-center justify-between mb-4 px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-emerald-500/20 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-300 text-sm font-medium">Live</span>
          </div>
          <div className="text-white font-semibold text-lg">{title}</div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-white/80 text-sm bg-white/10 px-3 py-1.5 rounded-lg">
            {formatTime(meetingTime)}
          </div>
          <button 
            onClick={handleShowParticipants}
            className="flex items-center space-x-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all duration-200"
          >
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <span className="text-sm font-medium">{participants.length} participants</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row lg:space-x-6 space-y-4 lg:space-y-0 min-h-0">
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 relative">
          {renderMainView()}
          
          {/* Enhanced Controls Bar */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
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
                className="flex-row space-x-3 bg-transparent shadow-none p-0"
              />
            </div>
          </div>
        </div>

        {/* Enhanced Participants Grid */}
        <div className="w-full lg:w-80 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-base">Participants</h3>
            <span className="text-white/60 text-sm bg-white/10 px-2 py-1 rounded-md">
              {participants.length}
            </span>
          </div>
          
          {/* Small screen: horizontal scroll with proper spacing */}
          <div className="lg:hidden flex space-x-2 overflow-x-auto scrollbar-hide pb-2">
            {[...participants]
              .sort((a, b) =>
                a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
              )
              .map((participant) => (
                <div
                  key={participant.userId}
                  className="flex-shrink-0 w-32"
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

          {/* Large screen: vertical grid layout with proper spacing */}
          <div className="hidden lg:flex lg:flex-col lg:space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto scrollbar-hide">
            {[...participants]
              .sort((a, b) =>
                a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
              )
              .map((participant) => (
                <div 
                  key={participant.userId}
                  className="w-full"
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
        </div>
      </div>

      {/* Enhanced Chat Drawer */}
      <Drawer
        title={
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-lg font-semibold">Chat</span>
          </div>
        }
        placement="right"
        onClose={() => setIsChatDrawerOpen(false)}
        open={isChatDrawerOpen}
        width={window.innerWidth < 600 ? 320 : 400}
        styles={{
          body: { 
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(20px)',
            padding: 0
          },
          header: {
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          }
        }}
      >
        <ChatPanel 
          sender={displayName} 
          messages={messages}
          onSendMessage={handleSendMessage}
        />
      </Drawer>

      {/* Enhanced Info Drawer */}
      <Drawer
        title={null}
        placement="right"
        onClose={() => setIsInfoDrawerOpen(false)}
        open={isInfoDrawerOpen}
        width={window.innerWidth < 600 ? 320 : 400}
        styles={{
          body: { 
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(20px)',
            padding: 0,
            height: '100%'
          }
        }}
        closable={false}
      >
        <div style={{ height: "100%" }}>
          <TaskList onClose={() => setIsInfoDrawerOpen(false)} />
        </div>
      </Drawer>

      {/* Enhanced Participants Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold">Participants</span>
            </div>
            <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-medium">
              {participants.length}
            </span>
          </div>
        }
        placement="right"
        onClose={() => setParticipantsDrawerOpen(false)}
        open={participantsDrawerOpen}
        width={window.innerWidth < 600 ? 320 : 400}
        styles={{
          body: { 
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(20px)',
            padding: '24px'
          },
          header: {
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white'
          }
        }}
      >
        <div className="space-y-4">
          {/* Select All Checkbox for Trainer */}
          {participants.find((p) => p.userId === "local")?.role === "trainer" && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <div className="flex items-center">
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
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 mr-3"
                />
                <span className="text-white font-medium">Select All Participants</span>
              </div>
            </div>
          )}

          {/* Individual Participants */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {[...participants]
              .sort((a, b) =>
                a.role === "trainer" ? -1 : b.role === "trainer" ? 1 : 0
              )
              .map((participant) => (
                <div
                  key={participant.userId}
                  className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transition-all duration-200 hover:bg-white/15"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
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
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                        )}
                      
                      <div className="flex items-center space-x-3">
                        <Avatar 
                          name={participant.name} 
                          size="sm" 
                        />
                        <div>
                          <div className="text-white font-medium">
                            {(() => {
                              const match = participant.name.match(/^(.*) \((\d+)\)$/);
                              return (
                                (match ? match[1] : participant.name) +
                                (participant.userId === "local" ? " (You)" : "")
                              );
                            })()}
                            {participant.role === "trainer" && (
                              <span className="ml-2 text-xs bg-amber-500/80 text-white px-2 py-0.5 rounded-full">
                                👨‍🏫 Trainer
                              </span>
                            )}
                          </div>
                          <div className="text-white/60 text-sm">{participant.role}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-full ${participant.audioEnabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {participant.audioEnabled ? (
                          <span className="text-green-400 text-sm">🎤</span>
                        ) : (
                          <span className="text-red-400 text-sm">🔇</span>
                        )}
                      </div>
                      <div className={`p-1.5 rounded-full ${participant.videoEnabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {participant.videoEnabled ? (
                          <span className="text-green-400 text-sm">🎥</span>
                        ) : (
                          <span className="text-red-400 text-sm">🚫</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Attendance Button (Trainer only) */}
          {participants.find((p) => p.userId === "local")?.role === "trainer" && (
            <div className="pt-4 border-t border-white/10">
              <button
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-2xl font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
                onClick={markAttendance}
              >
                📋 Mark Attendance
              </button>
            </div>
          )}
        </div>
      </Drawer>


      {/* Enhanced Leave Meeting Modal */}
      <Modal
        title={
          <div className="text-center">
            <div className="bg-red-500/20 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">Leave Meeting</span>
          </div>
        }
        open={isLeaveModalVisible}
        onCancel={() => setIsLeaveModalVisible(false)}
        footer={
          <div className="flex justify-center gap-4 pt-4">
            <Button
              key="cancel"
              variant="outline"
              onClick={() => setIsLeaveModalVisible(false)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50 px-8 py-2 rounded-xl"
            >
              Stay in Meeting
            </Button>
            <Button 
              key="leave" 
              variant="danger" 
              onClick={confirmLeaveMeeting}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-2 rounded-xl font-semibold"
            >
              Leave Meeting
            </Button>
          </div>
        }
        styles={{
          content: {
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px'
          },
          header: {
            background: 'transparent',
            borderBottom: 'none',
            padding: '24px 24px 0'
          },
          body: {
            padding: '0 24px'
          },
          footer: {
            background: 'transparent',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0 24px 24px'
          }
        }}
        centered
        width={480}
      >
        <div className="text-center py-6">
          <p className="text-white/80 text-lg mb-0">
            Are you sure you want to leave this meeting?<br />
            <span className="text-white/60 text-sm">Other participants will continue without you.</span>
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingPage;
