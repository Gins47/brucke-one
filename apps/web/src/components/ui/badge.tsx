import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      tone: {
        blue: 'border-blue-200 bg-blue-50 text-blue-800',
        neutral: 'border-slate-200 bg-slate-50 text-slate-700',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

/** Renders a small accessible status label using the shared shadcn/ui convention. */
export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
