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
          'flex h-10 w-full rounded-full border border-[#34373f] bg-[#1a1c20] px-4 py-2 text-sm text-[#d0d5dd] placeholder:text-[#6f7682] transition-all focus-visible:outline-none focus-visible:border-[#1db954]/55 focus-visible:ring-1 focus-visible:ring-[#1db954]/25 disabled:cursor-not-allowed disabled:opacity-50',
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
