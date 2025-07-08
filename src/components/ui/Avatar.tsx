import React from 'react';
import { twMerge } from 'tailwind-merge';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  size?: AvatarSize;
  className?: string;
  status?: 'online' | 'offline' | 'busy';
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  className,
  status,
}) => {
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  };

  const getSizeClass = (): string => {
    switch (size) {
      case 'sm':
        return 'w-8 h-8 text-xs';
      case 'md':
        return 'w-10 h-10 text-sm';
      case 'lg':
        return 'w-12 h-12 text-base';
      default:
        return 'w-10 h-10 text-sm';
    }
  };

  const getStatusClass = (): string => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'busy':
        return 'bg-red-500';
      default:
        return '';
    }
  };

  const getStatusSizeClass = (): string => {
    switch (size) {
      case 'sm':
        return 'w-2 h-2';
      case 'md':
        return 'w-3 h-3';
      case 'lg':
        return 'w-3.5 h-3.5';
      default:
        return 'w-3 h-3';
    }
  };

  return (
    <div className="relative inline-flex">
      <div
        className={twMerge(
          'flex items-center justify-center rounded-full bg-blue-100 text-blue-800 font-medium',
          getSizeClass(),
          className
        )}
      >
        {getInitials(name)}
      </div>
      {status && (
        <span
          className={twMerge(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            getStatusClass(),
            getStatusSizeClass()
          )}
        />
      )}
    </div>
  );
};

export default Avatar;