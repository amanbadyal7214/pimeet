import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const location = useLocation();
  const isInMeeting = location.pathname.includes('/meeting/');

  return (
    <header className="bg-black/20 backdrop-blur-md border-b border-white/10 py-4 px-4 sm:px-6 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              aria-label="Toggle menu"
              className="mr-4 text-white/80 hover:text-white md:hidden transition-colors duration-200"
            >
              <Menu size={24} />
            </button>
          )}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-2 group-hover:scale-110 transition-transform duration-200">
              <Video className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Pi Meet
            </span>
          </Link>
        </div>

        {!isInMeeting && (
          <div className="flex items-center space-x-3">
            <span className="text-white/70 text-sm">
              Welcome to Pi Meet
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
