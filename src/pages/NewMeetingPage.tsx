import React from 'react';
import CreateMeetingForm from '../components/meeting/CreateMeetingForm';
import Header from '../components/layout/Header';

const NewMeetingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 mt-16">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Create a New Meeting
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Start a secure video meeting and invite others to join
            </p>
          </div>
          
          <CreateMeetingForm />
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-gray-600 text-sm">
        <p>&copy; {new Date().getFullYear()} MeetNow. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default NewMeetingPage;