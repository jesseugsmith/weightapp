/**
 * Competition Card Skeleton
 * 
 * Shows skeleton loaders for competition cards in lists/grids.
 */

import { Skeleton } from './Skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface CompetitionCardSkeletonProps {
  count?: number;
  layout?: 'grid' | 'list';
}

export function CompetitionCardSkeleton({ 
  count = 3,
  layout = 'grid' 
}: CompetitionCardSkeletonProps) {
  return (
    <div className={layout === 'grid' 
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      : 'space-y-4'
    }>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-1">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              ))}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 w-10" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
