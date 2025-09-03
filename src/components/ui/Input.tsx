import React, { forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, fullWidth = false, ...props }, ref) => {
    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className="block text-sm font-semibold text-white mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge(
            'px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 text-white placeholder-white/60 text-sm transition-all duration-200',
            error ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : '',
            fullWidth ? 'w-full' : '',
            className
          )}
          {...props}
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;