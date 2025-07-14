import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Video, Menu } from 'lucide-react';
import Button from '../ui/Button';


interface HeaderProps {
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  const location = useLocation();
  const isInMeeting = location.pathname.includes('/meeting/');

  return (
    <header className="bg-gray-900 shadow-sm border-b border-gray-200 py-3 px-4 sm:px-6 fixed top-0 left-0 right-0 z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="mr-3 text-neutral-200 hover:text-gray-700 md:hidden"
            >
              <Menu size={24} />
            </button>
          )}
          <Link to="/" className="flex items-center space-x-2">
            <Video className="h-6 w-6 text-blue-600" />
            <span className="font-semibold text-xl text-neutral-300">Pi-Meet</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-3">
         
        <Link to="/" className="inline-block">
  <Button variant="outline" size="md" className="bg-neutral-100 hover:bg-neutral-300 text-gray-900">
    Join Meeting
  </Button>
</Link>
        </div>
      </div>
    </header>
  );
};

export default Header;