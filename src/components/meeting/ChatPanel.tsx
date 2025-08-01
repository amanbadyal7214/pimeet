import React, { useState, useEffect, useRef } from 'react';
import { SocketService } from '../../services/socket';
import { Socket } from 'socket.io-client';

interface Message {
  sender: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  roomId: string;
  sender: string;
}

interface ChatMessagePayload {
  userId: string;
  sender: string;
  message: string;
  timestamp: number;
}

const COLORS = [
  '#FFB6C1', // LightPink
  '#ADD8E6', // LightBlue
  '#90EE90', // LightGreen
  '#FFD700', // Gold
  '#FFA07A', // LightSalmon
  '#DDA0DD', // Plum
  '#87CEFA', // LightSkyBlue
  '#F08080', // LightCoral
];

function getColorForSender(sender: string): string {
  let hash = 0;
  for (let i = 0; i < sender.length; i++) {
    hash = sender.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, sender }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const socketInstance = SocketService.getInstance().getSocket();
    setSocket(socketInstance);

    if (!socketInstance) return;

    const handleIncomingMessage = (payload: ChatMessagePayload) => {
      if (payload.sender === sender) {
        // Ignore own message to avoid duplicate
        return;
      }
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: payload.sender, text: payload.message, timestamp: payload.timestamp },
      ]);
    };

    socketInstance.on('chat-message', handleIncomingMessage);

    return () => {
      socketInstance.off('chat-message', handleIncomingMessage);
    };
  }, [sender]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;

    if (socket) {
      socket.emit('chat-message', {
        roomId,
        message: newMessage.trim(),
        sender,
        timestamp: Date.now(),
      });
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: 'You', text: newMessage.trim(), timestamp: Date.now() },
    ]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  function formatRelativeTime(timestamp: number): string {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  function getInitials(name: string): string {
    const names = name.trim().split(' ');
    if (names.length === 0) return '';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[1].charAt(0)).toUpperCase();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white rounded-lg shadow-inner scrollbar-hide">
        {messages.map((msg, index) => {
          const isYou = msg.sender === 'You';
          const bubbleColor = isYou ? '#3B82F6' : getColorForSender(msg.sender);
          const alignClass = isYou ? 'self-end text-right' : 'self-start text-left';

          return (
            <div
              key={index}
              className={`flex items-start space-x-3 ${isYou ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              {!isYou && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold text-sm select-none">
                  {getInitials(msg.sender)}
                </div>
              )}
              <div className="max-w-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="font-semibold text-xs">{msg.sender}</div>
                  <div className="text-xs text-gray-500">{formatRelativeTime(msg.timestamp)}</div>
                </div>
                <div
                  className="p-3 rounded-lg break-words shadow-md max-w-[280px] whitespace-pre-wrap break-all"
                  style={{ backgroundColor: bubbleColor, color: isYou ? 'white' : 'black' }}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-300 p-3 bg-gray-50 flex items-center space-x-3 rounded-b-lg">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleSendMessage}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
