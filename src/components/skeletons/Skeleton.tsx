/**
 * Base Skeleton Component
 * 
 * Provides animated loading placeholders that match the shape of content being loaded.
 * Better UX than spinners as it shows structure and reduces perceived loading time.
 */

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'default',
  animation = 'pulse',
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-muted',
        {
          'animate-pulse': animation === 'pulse',
          'bg-gradient-to-r from-muted via-muted-foreground/10 to-muted animate-shimmer bg-[length:200%_100%]':
            animation === 'wave',
          'rounded-full': variant === 'circular',
          'rounded-md': variant === 'rectangular' || variant === 'default',
          'rounded h-4': variant === 'text',
        },
        className
      )}
    />
  );
}
