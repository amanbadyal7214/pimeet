import React, { useState, useEffect } from 'react';
import { SocketService } from '../../services/socket';
import { Socket } from 'socket.io-client';

interface Message {
  sender: string;
  text: string;
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

const ChatPanel: React.FC<ChatPanelProps> = ({ roomId, sender }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);

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
        { sender: payload.sender, text: payload.message },
      ]);
    };

    socketInstance.on('chat-message', handleIncomingMessage);

    return () => {
      socketInstance.off('chat-message', handleIncomingMessage);
    };
  }, []);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;

    if (socket) {
      socket.emit('chat-message', {
        roomId,
        message: newMessage.trim(),
        sender,
      });
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: 'You', text: newMessage.trim() },
    ]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`p-2 rounded text-sm max-w-xs ${
              msg.sender === 'You' ? 'bg-blue-100 self-end text-right' : 'bg-gray-100 self-start'
            }`}
          >
            <div className="font-semibold text-xs text-gray-500 mb-1">{msg.sender}</div>
            <div>{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-gray-300 p-2">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
    </div>
  );
};

export default ChatPanel;
