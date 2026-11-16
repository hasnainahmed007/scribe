import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#1db954] text-[#08100b] shadow-sm font-semibold',
        secondary:
          'border-[#282828] bg-[#1f1f1f] text-[#9ca3af]',
        emerald:
          'border-[#1db954]/25 bg-[#1db954]/12 text-[#4cc37c]',
        purple:
          'border-purple-400/25 bg-purple-500/12 text-purple-300/90',
        amber:
          'border-amber-400/25 bg-amber-500/12 text-amber-300/90',
        destructive:
          'border-[#f3727f]/25 bg-[#f3727f]/12 text-[#e88791]',
        outline:
          'border-[#3e424b] text-[#9ca3af]',
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
