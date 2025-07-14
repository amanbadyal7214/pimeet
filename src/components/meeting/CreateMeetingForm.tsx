import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, Bell, Users, X } from 'lucide-react';
import { generateMeetingId } from '../utils/meeting';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Header from '../components/layout/Header';

type Guest = {
  email: string;
  from: Date;
  to: Date;
};

const LabelInputContainer = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex w-full flex-col space-y-2 ${className}`}>{children}</div>
);

const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

const CreateMeetingForm: React.FC = () => {
  const navigate = useNavigate();
  const [meetingId] = useState(generateMeetingId());
  const [creatorName, setCreatorName] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [meetingType, setMeetingType] = useState('Today');
  const [guestInput, setGuestInput] = useState('');
  const [guestFrom, setGuestFrom] = useState(startDate);
  const [guestTo, setGuestTo] = useState(endDate);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meetingUrl = `${window.location.origin}/meeting/${meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGuestAdd = () => {
    const email = guestInput.trim().replace(/,+$/, '');
    if (email && !guests.find((g) => g.email === email)) {
      setGuests([...guests, { email, from: guestFrom, to: guestTo }]);
      setGuestInput('');
    }
  };

  const handleStartMeeting = (e: React.FormEvent) => {
    e.preventDefault();

    if (!creatorName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!meetingTitle.trim()) {
      setError('Please enter meeting title.');
      return;
    }

    if (guests.length === 0) {
      setError('Please add at least one guest.');
      return;
    }

    setError(null);
    setIsStarting(true);

    setTimeout(() => {
      navigate(`/meeting/${meetingId}`, {
        state: {
          creatorName,
          meetingTitle,
          startDate,
          startTime,
          endDate,
          endTime,
          guests,
        },
      });
    }, 1000);
  };

  const removeGuest = (email: string) => {
    setGuests(guests.filter((g) => g.email !== email));
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-black">
      <Header />
      <form
        onSubmit={handleStartMeeting}
        className="max-w-6xl mx-auto ml-20 mt-6 py-12 px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-8"
      >
        {/* LEFT SECTION */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow">
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-white mb-6">Meeting Details</h2>

          <LabelInputContainer className="mb-4">
            <label className="text-sm text-neutral-700 dark:text-neutral-300">Meeting Title</label>
            <Input
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Team Sync"
            />
          </LabelInputContainer>

          <LabelInputContainer className="mb-4">
            <label className="text-sm text-neutral-700 dark:text-neutral-300">Meeting Type</label>
            <select
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="w-full border px-3 py-2 rounded-md bg-white dark:bg-zinc-800 dark:text-white"
            >
              <option value="Today">Today</option>
              <option value="Daily">Daily</option>
              <option value="Weekdays">Weekdays</option>
              <option value="Custom">Custom</option>
            </select>
          </LabelInputContainer>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Start Date</label>
              <DatePicker selected={startDate} onChange={(d) => d && setStartDate(d)} className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>

            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Start Time</label>
              <DatePicker
                selected={startTime}
                onChange={(d) => d && setStartTime(d)}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={15}
                dateFormat="h:mm aa"
                className="w-full px-3 py-2 border rounded-md"
              />
            </LabelInputContainer>

            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">End Date</label>
              <DatePicker selected={endDate} onChange={(d) => d && setEndDate(d)} className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>

            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">End Time</label>
              <DatePicker
                selected={endTime}
                onChange={(d) => d && setEndTime(d)}
                showTimeSelect
                showTimeSelectOnly
                timeIntervals={15}
                dateFormat="h:mm aa"
                className="w-full px-3 py-2 border rounded-md"
              />
            </LabelInputContainer>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow flex flex-col justify-between">
          <div>
            <LabelInputContainer className="mb-4">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Your Name</label>
              <Input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="John Doe" />
            </LabelInputContainer>

            <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              <strong>Meeting Link:</strong> {meetingUrl}
              <div className="flex space-x-2 mt-2">
                <Button type="button" onClick={handleCopyLink} variant="outline">
                  <Copy size={16} className="mr-1" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    navigator.share
                      ? navigator.share({ title: 'Join my meeting', url: meetingUrl }).catch(handleCopyLink)
                      : handleCopyLink()
                  }
                  variant="outline"
                >
                  <Share2 size={16} className="mr-1" />
                  Share
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-md font-semibold text-neutral-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
                <Users size={18} /> Add Guest
              </h3>
              <Input
                placeholder="Guest Email"
                value={guestInput}
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGuestAdd();
                  }
                }}
                className="mb-4"
              />

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                <DatePicker
                  selected={guestFrom}
                  onChange={(d) => d && setGuestFrom(d)}
                  dateFormat="PPP"
                  placeholderText="From"
                  className="w-full px-3 py-2 border rounded-md"
                />
                <DatePicker
                  selected={guestTo}
                  onChange={(d) => d && setGuestTo(d)}
                  dateFormat="PPP"
                  placeholderText="To"
                  className="w-full px-3 py-2 border rounded-md"
                />
                <div className="col-span-1 sm:col-span-1">
                  <Button type="button" onClick={handleGuestAdd} className="w-full h-full">
                    Add
                  </Button>
                </div>
              </div>

              {guests.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-auto pr-1">
                  {guests.map((g, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-100 text-blue-800 px-3 py-2 rounded-md text-sm">
                      <div>
                        <strong>{g.email}</strong>
                        <div className="text-xs">
                          {g.from.toDateString()} → {g.to.toDateString()}
                        </div>
                      </div>
                      <X className="cursor-pointer hover:text-red-600" size={14} onClick={() => removeGuest(g.email)} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          </div>

          <button
            className="group/btn relative mt-6 w-full h-10 rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white dark:bg-zinc-800"
            type="submit"
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Meeting →'}
            <BottomGradient />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateMeetingForm;
