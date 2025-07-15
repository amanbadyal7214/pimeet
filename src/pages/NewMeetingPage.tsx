import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Share2, Users, X } from 'lucide-react';
import { generateMeetingId } from '../utils/meeting';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Header from '../components/layout/Header';
import { createClass } from '../api/classApi';

const meetingTitleOptions = ["Batch 9-11", "Batch 11-1", "Batch 2-4","Batch 4-6"];
const trainerOptions = ["John Doe", "Aman Badyal", "Riya Kapoor"];
const technologyOptions = ["MERN Stack", "PYTHON", "JAVA", "REACT"];

type Guest = {
  email: string;
};

const LabelInputContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
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
  const [meetingId] = useState<string>(generateMeetingId());
  const [nameOfTrainer, setNameOfTrainer] = useState<string>('');
  const [TrainerID, setTrainerId] = useState<string>('');
  const [meetingTitle, setMeetingTitle] = useState<string>('');
  const [technology, setTechnology] = useState<string>('');
  const [startingDate, setStartingDate] = useState<Date>(new Date());
  const [startingTime, setStartingTime] = useState<Date>(new Date());
  const [endingDate, setEndingDate] = useState<Date>(new Date());
  const [endingTime, setEndingTime] = useState<Date>(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [meetingType, setMeetingType] = useState<string>('');
  const [guestInput, setGuestInput] = useState<string>('');
  const [addGuest, setAddGuest] = useState<Guest[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const meetingLink = `${window.location.origin}/meeting/${meetingId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGuestAdd = () => {
    const email = guestInput.trim().replace(/,+$/, '');
    if (email && !addGuest.find((g) => g.email === email)) {
      setAddGuest((prev) => [...prev, { email }]);
      setGuestInput('');
    }
  };

  const removeGuest = (email: string) => {
    setAddGuest((prev) => prev.filter((g) => g.email !== email));
  };

  const handleStartMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOfTrainer.trim()) return setError('Please select trainer name.');
    if (!TrainerID.trim()) return setError('Please enter Trainer ID.');
    if (addGuest.length === 0) return setError('Please add at least one guest.');
    setError(null);
    setIsStarting(true);

    const payload = {
      meetingId,
      nameOfTrainer,
      TrainerID,
      meetingTitle,
      technology,
      meetingType,
      startingDate: startingDate.toISOString(),
      startingTime: startingTime.toISOString(),
      endingDate: endingDate.toISOString(),
      endingTime: endingTime.toISOString(),
      addGuest: addGuest.map((g) => g.email),
      meetingLink,
    };

    try {
      await createClass(payload);
      navigate(`/meeting/${meetingId}`, {
        state: { nameOfTrainer, meetingTitle, addGuest },
      });
    } catch (err) {
      console.error('API error:', err);
      setError('Failed to create meeting. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-black">
      <Header />
      <form onSubmit={handleStartMeeting} className="max-w-6xl mx-auto ml-20 pt-20 py-12 px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow">
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-white mb-6">Meeting Details</h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <LabelInputContainer className="w-full">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Meeting Title</label>
              <select value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} className="w-full border px-3 py-2 rounded-md bg-white dark:bg-zinc-800 dark:text-white">
                <option value="">Select Meeting Title</option>
                {meetingTitleOptions.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </LabelInputContainer>

            <LabelInputContainer className="w-full">
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Technology</label>
              <select value={technology} onChange={(e) => setTechnology(e.target.value)} className="w-full border px-3 py-2 rounded-md bg-white dark:bg-zinc-800 dark:text-white">
                <option value="">Select Technology</option>
                {technologyOptions.map((tech) => (
                  <option key={tech} value={tech}>{tech}</option>
                ))}
              </select>
            </LabelInputContainer>
          </div>

          <LabelInputContainer className="mb-4">
            <label className="text-sm text-neutral-700 dark:text-neutral-300 mb-1">Meeting Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['custom', 'week', 'monthly', 'daily'].map((type) => (
                <button key={type} type="button" onClick={() => setMeetingType(type)} className={`rounded-md px-4 py-2 border text-sm font-medium ${meetingType === type ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-white dark:bg-zinc-800 text-black dark:text-white border-gray-300 dark:border-zinc-700'}`}>
                  {type}
                </button>
              ))}
            </div>
          </LabelInputContainer>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Start Date</label>
              <DatePicker selected={startingDate} onChange={(d) => d && setStartingDate(d)} className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>
            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">Start Time</label>
              <DatePicker selected={startingTime} onChange={(d) => d && setStartingTime(d)} showTimeSelect showTimeSelectOnly timeIntervals={15} dateFormat="h:mm aa" className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>
            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">End Date</label>
              <DatePicker selected={endingDate} onChange={(d) => d && setEndingDate(d)} className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>
            <LabelInputContainer>
              <label className="text-sm text-neutral-700 dark:text-neutral-300">End Time</label>
              <DatePicker selected={endingTime} onChange={(d) => d && setEndingTime(d)} showTimeSelect showTimeSelectOnly timeIntervals={15} dateFormat="h:mm aa" className="w-full px-3 py-2 border rounded-md" />
            </LabelInputContainer>
          </div>
        </div>

        {/* Right Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <LabelInputContainer className="w-full">
                <label className="text-sm text-neutral-700 dark:text-neutral-300">Trainer Name</label>
                <select value={nameOfTrainer} onChange={(e) => setNameOfTrainer(e.target.value)} className="w-full border px-3 py-2 rounded-md bg-white dark:bg-zinc-800 dark:text-white">
                  <option value="">Select Trainer</option>
                  {trainerOptions.map((trainer) => (
                    <option key={trainer} value={trainer}>{trainer}</option>
                  ))}
                </select>
              </LabelInputContainer>
              <LabelInputContainer className="w-full">
                <label className="text-sm text-neutral-700 dark:text-neutral-300">Trainer ID</label>
                <Input value={TrainerID} onChange={(e) => setTrainerId(e.target.value)} placeholder="TR123" />
              </LabelInputContainer>
            </div>

            <div className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">
              <strong>Meeting Link:</strong> {meetingLink}
              <div className="flex space-x-2 mt-2">
                <Button type="button" onClick={handleCopyLink} variant="outline">
                  <Copy size={16} className="mr-1" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    navigator.share
                      ? navigator.share({ title: 'Join my meeting', url: meetingLink }).catch(handleCopyLink)
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
                <div className="col-span-1 sm:col-span-1">
                  <Button type="button" onClick={handleGuestAdd} className="w-full h-full">
                    Add
                  </Button>
                </div>
              </div>
              {addGuest.length > 0 && (
                <div className="flex flex-col gap-2 max-h-48 overflow-auto pr-1">
                  {addGuest.map((g, i) => (
                    <div key={i} className="flex items-center justify-between bg-blue-100 text-blue-800 px-3 py-2 rounded-md text-sm">
                      <strong>{g.email}</strong>
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
