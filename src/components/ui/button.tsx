import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-[#1ed760] text-black font-bold hover:bg-[#1fdf64] hover:scale-[1.03] shadow-[0_4px_14px_rgba(30,215,96,0.25)]',
        destructive:
          'bg-[#f3727f]/15 text-[#f3727f] border border-[#f3727f]/30 hover:bg-[#f3727f]/25',
        outline:
          'border border-[#7c7c7c] bg-transparent text-white hover:border-white hover:scale-[1.03]',
        secondary:
          'bg-[#1f1f1f] text-white hover:bg-[#282828] hover:scale-[1.02] border border-[#2e2e2e]',
        ghost:
          'text-[#b3b3b3] hover:text-white hover:bg-[#1f1f1f]',
        link:
          'text-[#1ed760] underline-offset-4 hover:underline p-0 h-auto font-semibold',
        purple:
          'bg-purple-600 text-white font-bold hover:bg-purple-500 shadow-sm hover:scale-[1.02]',
        play:
          'rounded-full bg-[#1ed760] text-black hover:bg-[#1fdf64] hover:scale-[1.06] shadow-[0_8px_20px_rgba(30,215,96,0.3)]',
      },
      size: {
        default: 'h-9 px-5 py-2 text-sm',
        sm: 'h-8 px-4 text-xs',
        lg: 'h-11 px-7 text-sm tracking-wide',
        icon: 'h-9 w-9 rounded-full p-0',
        'icon-sm': 'h-7 w-7 rounded-full p-0',
        play: 'h-11 w-11 rounded-full p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
