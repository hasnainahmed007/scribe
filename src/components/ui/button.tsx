import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#1db954]/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 cursor-pointer select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-[#1db954] text-[#08100b] font-semibold hover:bg-[#1aa34a] shadow-sm',
        destructive:
          'bg-[#f3727f]/12 text-[#e88791] border border-[#f3727f]/25 hover:bg-[#f3727f]/20',
        outline:
          'border border-[#3a3e46] bg-transparent text-[#d0d5dd] hover:border-[#555a65] hover:text-[#e4e7ec] hover:bg-[#1f1f1f]',
        secondary:
          'bg-[#1f1f1f] text-[#d0d5dd] hover:bg-[#282828] hover:text-[#e4e7ec] border border-[#2e3138]',
        ghost:
          'text-[#9ca3af] hover:text-[#e4e7ec] hover:bg-[#1f1f1f]',
        link:
          'text-[#34a866] underline-offset-4 hover:underline p-0 h-auto font-semibold',
        purple:
          'bg-purple-600/85 text-[#e4e7ec] font-semibold hover:bg-purple-600 shadow-sm',
        play:
          'rounded-full bg-[#1db954] text-[#08100b] hover:bg-[#1aa34a] shadow-sm',
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
