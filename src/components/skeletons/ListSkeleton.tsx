/**
 * List Skeleton
 * 
 * Generic list skeleton for various list layouts.
 * Used for competition lists, user lists, etc.
 */

import { Skeleton } from './Skeleton';

interface ListSkeletonProps {
  itemCount?: number;
  hasAvatar?: boolean;
  hasActions?: boolean;
  className?: string;
}

export function ListSkeleton({
  itemCount = 5,
  hasAvatar = false,
  hasActions = false,
  className,
}: ListSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 border-b border-border last:border-0"
        >
          <div className="flex items-center gap-4 flex-1">
            {hasAvatar && <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />}
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          {hasActions && (
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
