import React from 'react';

const MessageArea: React.FC = () => {
  return (
    <div className="bg-gray-800 rounded-xl p-4 text-white w-full max-w-4xl mx-auto flex items-center space-x-4">
      <div className="flex items-center space-x-1">
        {/* Audio bars animation */}
        <div className="w-1.5 h-6 bg-green-400 rounded animate-pulse"></div>
        <div className="w-1.5 h-4 bg-green-400 rounded animate-pulse delay-150"></div>
        <div className="w-1.5 h-5 bg-green-400 rounded animate-pulse delay-300"></div>
        <div className="w-1.5 h-3 bg-green-400 rounded animate-pulse delay-450"></div>
      </div>
      <p className="text-sm leading-relaxed">
        Hello Guys, Thanks to all who have joined this video Conference. Hope you guys are fit and enjoying! We have to redesign our website with the motive of having good <span className="text-gray-400">User Experience</span>. We&apos;ll do some basic research and then prepare a Style guide
      </p>
    </div>
  );
};

export default MessageArea;
