/**
 * Activity History Skeleton
 * 
 * Shows skeleton loaders for activity history cards.
 * Matches the structure of ActivityHistory component.
 */

import { Skeleton } from './Skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ActivityHistorySkeletonProps {
  itemCount?: number;
}

export function ActivityHistorySkeleton({ itemCount = 5 }: ActivityHistorySkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: itemCount }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
              <Skeleton className="h-6 w-16 rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
