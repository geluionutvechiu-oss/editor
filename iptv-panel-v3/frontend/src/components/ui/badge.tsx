import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/20 text-primary',
        active: 'border-green-500/30 bg-green-500/15 text-green-400',
        suspended: 'border-red-500/30 bg-red-500/15 text-red-400',
        expired: 'border-orange-500/30 bg-orange-500/15 text-orange-400',
        pending: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
        paid: 'border-green-500/30 bg-green-500/15 text-green-400',
        overdue: 'border-red-500/30 bg-red-500/15 text-red-400',
        online: 'border-green-500/30 bg-green-500/15 text-green-400',
        offline: 'border-red-500/30 bg-red-500/15 text-red-400',
        degraded: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
        info: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
        warning: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
        error: 'border-red-500/30 bg-red-500/15 text-red-400',
        success: 'border-green-500/30 bg-green-500/15 text-green-400',
        admin: 'border-purple-500/30 bg-purple-500/15 text-purple-400',
        reseller: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'text-foreground border-border',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
