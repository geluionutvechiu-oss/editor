import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        variant === 'default' && 'bg-primary/20 text-primary border-primary/30',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground border-border',
        variant === 'destructive' && 'bg-destructive/20 text-destructive border-destructive/30',
        variant === 'outline' && 'bg-transparent text-foreground border-border',
        className
      )}
    >
      {children}
    </span>
  )
}
