import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Copy, Share2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { generateMeetingId } from '../../utils/meeting';

const CreateMeetingForm: React.FC = () => {
  const navigate = useNavigate();
  const [meetingId] = useState(generateMeetingId());
  const [displayName, setDisplayName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meetingUrl = `${window.location.origin}/meeting/${meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleStartMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setIsStarting(true);
    
    // Simulate a brief loading state
    setTimeout(() => {
      navigate(`/meeting/${meetingId}?name=${encodeURIComponent(displayName)}`);
      setIsStarting(false);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 max-w-md w-full mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div className="bg-blue-100 rounded-full p-3 mb-4">
          <Video className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900">Create a Meeting</h2>
        <p className="text-gray-600 mt-1 text-center">
          Share the meeting link with others to invite them
        </p>
      </div>

      <div className="mb-6 p-3 bg-gray-50 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-700">Meeting Link</div>
            <div className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-xs">
              {meetingUrl}
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              leftIcon={<Copy size={16} />}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Join my meeting',
                    text: 'Join my video meeting',
                    url: meetingUrl,
                  });
                } else {
                  handleCopyLink();
                }
              }}
              leftIcon={<Share2 size={16} />}
            >
              Share
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleStartMeeting} className="space-y-4">
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
          isLoading={isStarting}
        >
          Start Meeting
        </Button>
      </form>
    </div>
  );
};

export default CreateMeetingForm;