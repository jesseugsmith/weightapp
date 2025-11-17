/**
 * Table Skeleton
 * 
 * Shows skeleton loaders for table layouts.
 * Used for data tables, standings, etc.
 */

import { Skeleton } from './Skeleton';

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  hasHeader?: boolean;
  className?: string;
}

export function TableSkeleton({
  columns = 4,
  rows = 5,
  hasHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={className}>
      <div className="border rounded-lg overflow-hidden">
        {hasHeader && (
          <div className="bg-muted/50 border-b border-border">
            <div className="flex p-4 gap-4">
              {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} className="h-5 flex-1" />
              ))}
            </div>
          </div>
        )}
        <div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="flex p-4 gap-4 border-b border-border last:border-0"
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
