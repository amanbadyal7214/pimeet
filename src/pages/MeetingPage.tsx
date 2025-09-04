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
import ServiceRequestPanel from "../components/meeting/ServiceRequestPanel";
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
  
  // Service request state
  const [pendingServiceRequests, setPendingServiceRequests] = useState(0);
  
  // Kicked users state (to prevent rejoining on same day)
  const [kickedUsers, setKickedUsers] = useState<Set<string>>(new Set());
  const [rejoinRequests, setRejoinRequests] = useState<any[]>([]);
  const [showRejoinModal, setShowRejoinModal] = useState(false);


  const pinnedVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Check if user was kicked in last 2 hours
  useEffect(() => {
    if (studentId && meetingId) {
      const kickedTime = localStorage.getItem(`kicked_${meetingId}_${studentId}_time`);
      
      if (kickedTime) {
        const kickTime = new Date(kickedTime);
        const currentTime = new Date();
        const timeDifference = (currentTime.getTime() - kickTime.getTime()) / (1000 * 60 * 60); // Hours
        
        if (timeDifference < 2) {
          const remainingMinutes = Math.ceil((2 - timeDifference) * 60);
          alert(`You have been removed from this meeting and cannot rejoin for ${remainingMinutes} minutes.`);
          
          // Redirect based on user type
          if (studentId === "trainer") {
            window.location.href =
              "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
          } else if (studentId) {
            window.location.href =
              "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
          } else {
            window.location.href = "/";
          }
          return;
        } else {
          // 2 hours have passed, remove the restriction
          localStorage.removeItem(`kicked_${meetingId}_${studentId}_time`);
        }
      }
    }
  }, [studentId, meetingId]);

  useEffect(() => {
    const socketUrl = "https://pi.comsdesk.com"; // Adjust if needed
    SocketService.getInstance().connect(socketUrl);
    
    // Add cleanup on page unload
    const handleBeforeUnload = () => {
      const socket = SocketService.getInstance().getSocket();
      if (studentId === "trainer" && socket) {
        // If trainer is leaving via browser close, end the meeting
        socket.emit('end-meeting', { roomId: meetingId });
      }
      clearMeetingLocalStorage();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [studentId, meetingId]);

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

    const handleKickedFromMeeting = (payload: any) => {
      alert(`You have been removed from the meeting by ${payload.kickerName}`);
      
      // Store kicked time in localStorage for 2-hour restriction
      const kickTime = new Date().toISOString();
      localStorage.setItem(`kicked_${meetingId}_${studentId}_time`, kickTime);
      
      // Redirect based on user type
      if (studentId === "trainer") {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
      } else if (studentId) {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
      } else {
        window.location.href = "/";
      }
    };

    const handleUserKicked = (payload: any) => {
      console.log(`User ${payload.userName} was kicked by ${payload.kickerName}`);
      
      // Add to kicked users set
      setKickedUsers(prev => new Set([...prev, payload.userId]));
      
      // Clear pinned participant if the kicked user was pinned
      if (pinnedParticipantId === payload.userId) {
        setPinnedParticipantId(null);
      }
      
      // Remove kicked user from selected participants if they were selected
      setSelectedParticipants((prev) => 
        prev.filter((userId) => userId !== payload.userId)
      );
    };

    const handleRejoinRequest = (payload: any) => {
      if (studentId === "trainer") {
        setRejoinRequests(prev => [...prev, payload]);
        setShowRejoinModal(true);
        console.log(`Rejoin request from ${payload.displayName}`);
      }
    };

    const handleKickPermissionRequired = (payload: any) => {
      const message = payload.remainingTime 
        ? `${payload.message}\nRemaining time: ${payload.remainingTime} minutes`
        : payload.message;
      
      alert(message);
      
      // Show countdown if remaining time exists
      if (payload.remainingTime) {
        let remainingMinutes = payload.remainingTime;
        const countdownInterval = setInterval(() => {
          remainingMinutes--;
          if (remainingMinutes <= 0) {
            clearInterval(countdownInterval);
            alert("2-hour restriction has expired. You can now try to rejoin the meeting.");
          } else if (remainingMinutes % 10 === 0) {
            // Show reminder every 10 minutes
            console.log(`Remaining time to rejoin: ${remainingMinutes} minutes`);
          }
        }, 60000); // Check every minute
        
        // Store interval ID to clear it later if needed
        (window as any).rejoinCountdownInterval = countdownInterval;
      }
      
      // Keep showing the alert until trainer approves or time expires
      const checkApproval = setInterval(() => {
        // This will be cleared when rejoin is approved or denied
      }, 5000);
      
      // Store interval ID to clear it later if needed
      (window as any).rejoinCheckInterval = checkApproval;
    };

    const handleRejoinApproved = (payload: any) => {
      alert(payload.message);
      // Clear any pending intervals
      if ((window as any).rejoinCheckInterval) {
        clearInterval((window as any).rejoinCheckInterval);
      }
      if ((window as any).rejoinCountdownInterval) {
        clearInterval((window as any).rejoinCountdownInterval);
      }
      
      // Clear kicked time from localStorage
      localStorage.removeItem(`kicked_${meetingId}_${studentId}_time`);
      
      // Reload the page to rejoin
      window.location.reload();
    };

    const handleRejoinDenied = (payload: any) => {
      alert(payload.message);
      // Clear any pending intervals
      if ((window as any).rejoinCheckInterval) {
        clearInterval((window as any).rejoinCheckInterval);
      }
      if ((window as any).rejoinCountdownInterval) {
        clearInterval((window as any).rejoinCountdownInterval);
      }
      
      // Redirect back
      if (studentId === "trainer") {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
      } else if (studentId) {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
      } else {
        window.location.href = "/";
      }
    };

    const handleMeetingEnded = (payload: any) => {
      alert(payload.message);
      // Clear all localStorage data for this meeting
      clearMeetingLocalStorage();
      
      // Redirect based on user type
      if (studentId === "trainer") {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
      } else if (studentId) {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
      } else {
        window.location.href = "/";
      }
    };

    const handleTrainerLeft = (payload: any) => {
      alert(payload.message);
      // Clear kicked user restrictions when trainer leaves
      clearMeetingLocalStorage();
    };

    const handleEntryPermissionRequired = (payload: any) => {
      alert(payload.message);
      // Show waiting message
      console.log("Waiting for trainer approval...");
    };

    const handleEntryApproved = (payload: any) => {
      alert(payload.message);
      // Don't reload page, just continue with current connection
      console.log("✅ Entry approved, joining meeting...");
    };

    const handleEntryDenied = (payload: any) => {
      alert(payload.message);
      // Redirect based on user type
      if (studentId === "trainer") {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/createMeeting";
      } else if (studentId) {
        window.location.href =
          "https://project.pisofterp.com/pipl/createMeeting/ongoingClasses";
      } else {
        window.location.href = "/";
      }
    };

    const handleEntryRequest = (_payload: any) => {
      // Only trainers should handle entry requests
      if (studentId === "trainer") {
        setPendingServiceRequests(prev => prev + 1);
      }
    };

    const handleEntryRequestProcessed = () => {
      // Decrease count when request is processed (approved/denied)
      if (studentId === "trainer") {
        setPendingServiceRequests(prev => Math.max(0, prev - 1));
      }
    };

    socket.on('chat-message', handleIncomingMessage);
    socket.on('kicked-from-meeting', handleKickedFromMeeting);
    socket.on('user-kicked', handleUserKicked);
    socket.on('rejoin-request', handleRejoinRequest);
    socket.on('kick-permission-required', handleKickPermissionRequired);
    socket.on('rejoin-approved', handleRejoinApproved);
    socket.on('rejoin-denied', handleRejoinDenied);
    socket.on('meeting-ended', handleMeetingEnded);
    socket.on('trainer-left', handleTrainerLeft);
    socket.on('entry-permission-required', handleEntryPermissionRequired);
    socket.on('entry-approved', handleEntryApproved);
    socket.on('entry-denied', handleEntryDenied);
    socket.on('entry-request', handleEntryRequest);
    socket.on('approve-entry', handleEntryRequestProcessed);
    socket.on('deny-entry', handleEntryRequestProcessed);

    return () => {
      socket.off('chat-message', handleIncomingMessage);
      socket.off('kicked-from-meeting', handleKickedFromMeeting);
      socket.off('user-kicked', handleUserKicked);
      socket.off('rejoin-request', handleRejoinRequest);
      socket.off('kick-permission-required', handleKickPermissionRequired);
      socket.off('rejoin-approved', handleRejoinApproved);
      socket.off('rejoin-denied', handleRejoinDenied);
      socket.off('meeting-ended', handleMeetingEnded);
      socket.off('trainer-left', handleTrainerLeft);
      socket.off('entry-permission-required', handleEntryPermissionRequired);
      socket.off('entry-approved', handleEntryApproved);
      socket.off('entry-denied', handleEntryDenied);
      socket.off('entry-request', handleEntryRequest);
      socket.off('approve-entry', handleEntryRequestProcessed);
      socket.off('deny-entry', handleEntryRequestProcessed);
    };
  }, [isChatDrawerOpen, studentId, meetingId, pinnedParticipantId]);

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
      // Skip kicked users
      if (kickedUsers.has(userId)) {
        return;
      }
      
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
    kickedUsers,
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
    const socket = SocketService.getInstance().getSocket();
    
    if (studentId === "trainer" && socket) {
      // If trainer is leaving, end the meeting for everyone
      socket.emit('end-meeting', { roomId: meetingId });
    }
    
    // Clear localStorage for this user
    clearMeetingLocalStorage();
    
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
  const handleShowInfo = () => {
    setIsInfoDrawerOpen(true);
    // Reset service request count when opening the panel
    setPendingServiceRequests(0);
  };

  const handlePinParticipant = (userId: string) => {
    setPinnedParticipantId(userId === pinnedParticipantId ? null : userId);
  };

  // Clear meeting-related localStorage data
  const clearMeetingLocalStorage = () => {
    if (meetingId && studentId) {
      // Clear kicked user time data
      localStorage.removeItem(`kicked_${meetingId}_${studentId}_time`);
      
      // Clear any other meeting-related data if needed
      console.log(`🗑️ Cleared localStorage for meeting ${meetingId}, user ${studentId}`);
    }
  };

  // Handle kick participant (only trainers can kick)
  const handleKickParticipant = (participantUserId: string, participantName: string) => {
    const socket = SocketService.getInstance().getSocket();
    if (!socket || studentId !== "trainer") {
      console.log("Only trainers can kick participants");
      return;
    }

    if (window.confirm(`Are you sure you want to remove ${participantName} from the meeting?`)) {
      // Clear pinned participant if the kicked user was pinned
      if (pinnedParticipantId === participantUserId) {
        setPinnedParticipantId(null);
      }

      // Immediately remove from selectedParticipants for instant UI feedback
      setSelectedParticipants((prev) => 
        prev.filter((userId) => userId !== participantUserId)
      );

      // Add to kicked users for immediate UI update
      setKickedUsers(prev => new Set([...prev, participantUserId]));

      socket.emit('kick-participant', {
        roomId: meetingId,
        targetUserId: participantUserId,
        kickerName: displayName
      });

      console.log(`Kicked participant: ${participantName} (${participantUserId})`);
    }
  };

  // Handle approve rejoin request
  const handleApproveRejoin = (request: any) => {
    const socket = SocketService.getInstance().getSocket();
    if (socket && studentId === "trainer") {
      socket.emit('approve-rejoin', {
        roomId: meetingId,
        displayName: request.displayName,
        userId: request.userId
      });

      // Remove from pending requests
      setRejoinRequests(prev => prev.filter(r => r.userId !== request.userId));
      
      console.log(`Approved rejoin for ${request.displayName}`);
    }
  };

  // Handle deny rejoin request
  const handleDenyRejoin = (request: any) => {
    const socket = SocketService.getInstance().getSocket();
    if (socket && studentId === "trainer") {
      socket.emit('deny-rejoin', {
        roomId: meetingId,
        displayName: request.displayName,
        userId: request.userId
      });

      // Remove from pending requests
      setRejoinRequests(prev => prev.filter(r => r.userId !== request.userId));
      
      console.log(`Denied rejoin for ${request.displayName}`);
    }
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
                pendingServiceRequests={pendingServiceRequests}
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
            background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            backdropFilter: 'blur(20px)',
            padding: 0
          },
          header: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#1e293b'
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
            background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            backdropFilter: 'blur(20px)',
            padding: 0,
            height: '100%'
          }
        }}
        closable={false}
      >
        <div style={{ height: "100%" }}>
          <ServiceRequestPanel 
            onClose={() => setIsInfoDrawerOpen(false)} 
            isTrainer={studentId === "trainer"}
            meetingId={meetingId}
          />
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
                      
                      {/* Kick button - only show for trainer and only for non-trainer participants */}
                      {participants.find((p) => p.userId === "local")?.role === "trainer" && 
                       participant.role !== "trainer" && 
                       participant.userId !== "local" && (
                        <button
                          onClick={() => {
                            const participantName = (() => {
                              const match = participant.name.match(/^(.*) \((\d+)\)$/);
                              return match ? match[1] : participant.name;
                            })();
                            handleKickParticipant(participant.userId, participantName);
                          }}
                          className="p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors duration-200 group"
                          title="Remove participant"
                        >
                          <span className="text-red-400 group-hover:text-red-300 text-sm">🚫</span>
                        </button>
                      )}
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

      {/* Rejoin Requests Modal (Trainer only) */}
      {studentId === "trainer" && (
        <Modal
          title={
            <div className="text-center">
              <div className="bg-blue-500/20 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">Rejoin Requests</span>
            </div>
          }
          open={showRejoinModal && rejoinRequests.length > 0}
          onCancel={() => setShowRejoinModal(false)}
          footer={null}
          styles={{
            content: {
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px'
            }
          }}
          width={500}
          maskStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          destroyOnClose
        >
          <div className="space-y-4">
            {rejoinRequests.map((request, index) => (
              <div key={index} className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-500/20 rounded-full p-2">
                      <span className="text-blue-400">👤</span>
                    </div>
                    <div>
                      <div className="text-white font-medium">{request.displayName}</div>
                      <div className="text-white/60 text-sm">
                        Wants to rejoin the meeting
                        {request.remainingTime && (
                          <span className="block text-orange-400 text-xs mt-1">
                            ⏰ Can rejoin in {request.remainingTime} minutes without approval
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApproveRejoin(request)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleDenyRejoin(request)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                    >
                      ❌ Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MeetingPage;
