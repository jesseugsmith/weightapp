/**
 * Card Skeleton
 * 
 * Generic card skeleton for various card-based layouts.
 * Used for competition cards, profile cards, etc.
 */

import { Skeleton } from './Skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface CardSkeletonProps {
  hasHeader?: boolean;
  hasFooter?: boolean;
  contentLines?: number;
  className?: string;
}

export function CardSkeleton({
  hasHeader = true,
  hasFooter = false,
  contentLines = 3,
  className,
}: CardSkeletonProps) {
  return (
    <Card className={className}>
      {hasHeader && (
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-full' : i === 1 ? 'w-5/6' : 'w-4/6'}`} />
        ))}
      </CardContent>
      {hasFooter && (
        <div className="px-6 pb-6">
          <Skeleton className="h-10 w-full" />
        </div>
      )}
    </Card>
  );
}
