import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';

const JoinMeetingForm: React.FC = () => {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!meetingId.trim()) {
      setError('Please enter a meeting ID');
      return;
    }
    
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setIsJoining(true);
    
    // Simulate a brief loading state
    setTimeout(() => {
      navigate(`/meeting/${meetingId}?name=${encodeURIComponent(displayName)}`);
      setIsJoining(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 max-w-md w-full mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className="bg-blue-100 rounded-full p-3 mb-4">
          <Video className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Join a Meeting</h2>
        <p className="text-gray-600 mt-1 text-center">
          Enter a meeting ID and your name to join
        </p>
      </div>

      <form onSubmit={handleJoin} className="space-y-4">
        <Input
          label="Meeting ID"
          value={meetingId}
          onChange={(e) => {
            setMeetingId(e.target.value);
            setError(null);
          }}
          placeholder="Enter meeting ID"
          fullWidth
          required
        />
        
        <Input
          label="Your Name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setError(null);
          }}
          placeholder="Enter your name"
          fullWidth
          required
        />
        
        {error && <p className="text-red-600 text-sm">{error}</p>}
        
        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isJoining}
        >
          Join Meeting
        </Button>
      </form>
    </div>
  );
};

export default JoinMeetingForm;