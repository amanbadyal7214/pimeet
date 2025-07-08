import React from 'react';
import JoinMeetingForm from '../components/meeting/JoinMeetingForm';
import Header from '../components/layout/Header';

const HomePage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center px-4 mt-16">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Free, Secure, High-Quality Video Meetings
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Connect with anyone, anywhere, on any device with our simple and reliable video conferencing solution.
            </p>
          </div>
          
          <JoinMeetingForm />
        </div>
      </main>
      
      <footer className="mt-auto py-6 text-center text-gray-600 text-sm">
        <p>&copy; {new Date().getFullYear()} MeetNow. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;