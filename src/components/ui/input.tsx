import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-full border border-[#2a2a2a] bg-[#1f1f1f] px-4 py-2 text-xs text-white placeholder:text-[#7c7c7c] transition-all focus-visible:outline-none focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
