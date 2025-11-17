/**
 * Leaderboard Skeleton
 * 
 * Shows skeleton loaders for leaderboard with podium and participant list.
 * Matches the structure of LeaderboardCard component.
 */

import { Skeleton } from './Skeleton';

interface LeaderboardSkeletonProps {
  showPodium?: boolean;
  participantCount?: number;
}

export function LeaderboardSkeleton({
  showPodium = true,
  participantCount = 5,
}: LeaderboardSkeletonProps) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto px-6">
        <Skeleton className="h-7 w-64" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>

      {/* Podium */}
      {showPodium && (
        <div className="mb-8 w-full bg-muted/30 py-8 md:py-12">
          <div className="flex items-end justify-center gap-2 md:gap-4 max-w-4xl mx-auto px-2 md:px-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center w-[110px] md:w-[180px]">
              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-full mb-2 md:mb-3" />
              <Skeleton className="h-48 md:h-56 w-full rounded-lg" />
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center w-[110px] md:w-[180px]">
              <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-full mb-2 md:mb-3" />
              <Skeleton className="h-56 md:h-64 w-full rounded-lg" />
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center w-[110px] md:w-[180px]">
              <Skeleton className="h-12 w-12 md:h-16 md:w-16 rounded-full mb-2 md:mb-3" />
              <Skeleton className="h-40 md:h-48 w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Remaining Participants */}
      <div className="space-y-3 max-w-4xl mx-auto px-4">
        {!showPodium && <Skeleton className="h-6 w-48 mb-4" />}
        {Array.from({ length: participantCount }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
          >
            <div className="flex items-center space-x-4 flex-1">
              <Skeleton className="h-6 w-12" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 text-center max-w-7xl mx-auto">
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    </div>
  );
}
