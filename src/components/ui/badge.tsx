import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wide transition-colors focus:outline-none select-none font-mono',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#1ed760] text-black shadow-sm font-bold',
        secondary:
          'border-[#282828] bg-[#1f1f1f] text-[#b3b3b3]',
        emerald:
          'border-[#1ed760]/30 bg-[#1ed760]/15 text-[#1ed760]',
        purple:
          'border-purple-500/30 bg-purple-500/15 text-purple-300',
        amber:
          'border-[#ffa42b]/30 bg-[#ffa42b]/15 text-[#ffa42b]',
        destructive:
          'border-[#f3727f]/30 bg-[#f3727f]/15 text-[#f3727f]',
        outline:
          'border-[#4d4d4d] text-[#b3b3b3]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
