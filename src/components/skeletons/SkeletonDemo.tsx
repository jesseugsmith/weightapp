/**
 * Skeleton Components Demo
 * 
 * Example usage of all skeleton components.
 * This file can be used as a reference or style guide.
 */

'use client';

import { useState } from 'react';
import {
  Skeleton,
  LeaderboardSkeleton,
  ActivityHistorySkeleton,
  CardSkeleton,
  ListSkeleton,
  TableSkeleton,
  ProfileSkeleton,
  CompetitionCardSkeleton,
} from './index';

export function SkeletonDemo() {
  const [activeDemo, setActiveDemo] = useState<string>('leaderboard');

  const demos = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'activity', label: 'Activity History' },
    { id: 'card', label: 'Card' },
    { id: 'list', label: 'List' },
    { id: 'table', label: 'Table' },
    { id: 'profile', label: 'Profile' },
    { id: 'competition', label: 'Competition Cards' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Skeleton Components Demo</h1>
          <p className="text-muted-foreground">
            Preview and test skeleton loading states
          </p>
        </div>

        {/* Demo Selector */}
        <div className="flex flex-wrap gap-2">
          {demos.map((demo) => (
            <button
              key={demo.id}
              onClick={() => setActiveDemo(demo.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeDemo === demo.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {demo.label}
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div className="space-y-4">
          {activeDemo === 'leaderboard' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Leaderboard Skeleton</h2>
              <LeaderboardSkeleton showPodium={true} participantCount={5} />
            </div>
          )}

          {activeDemo === 'activity' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Activity History Skeleton</h2>
              <ActivityHistorySkeleton itemCount={5} />
            </div>
          )}

          {activeDemo === 'card' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Card Skeleton</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton hasHeader={true} hasFooter={false} contentLines={3} />
                <CardSkeleton hasHeader={true} hasFooter={true} contentLines={4} />
                <CardSkeleton hasHeader={false} hasFooter={true} contentLines={5} />
              </div>
            </div>
          )}

          {activeDemo === 'list' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">List Skeleton</h2>
              <div className="max-w-2xl">
                <ListSkeleton itemCount={5} hasAvatar={true} hasActions={true} />
              </div>
            </div>
          )}

          {activeDemo === 'table' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Table Skeleton</h2>
              <TableSkeleton columns={4} rows={5} hasHeader={true} />
            </div>
          )}

          {activeDemo === 'profile' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Profile Skeleton</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">Full Profile</h3>
                  <ProfileSkeleton variant="full" />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">Profile Card</h3>
                  <ProfileSkeleton variant="card" />
                </div>
              </div>
            </div>
          )}

          {activeDemo === 'competition' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Competition Card Skeleton</h2>
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">Grid Layout</h3>
                  <CompetitionCardSkeleton count={3} layout="grid" />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">List Layout</h3>
                  <CompetitionCardSkeleton count={2} layout="list" />
                </div>
              </div>
            </div>
          )}

          {activeDemo === 'custom' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Custom Skeleton Example</h2>
              <div className="max-w-2xl space-y-4">
                {/* Custom composed skeleton */}
                <div className="border rounded-lg p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <Skeleton variant="circular" className="h-16 w-16" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-10 flex-1" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                </div>

                {/* Animation variants */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Animation Types</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium mb-2">Pulse (Default)</p>
                      <Skeleton animation="pulse" className="h-4 w-full" />
                      <Skeleton animation="pulse" className="h-4 w-3/4" />
                    </div>
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium mb-2">Wave</p>
                      <Skeleton animation="wave" className="h-4 w-full" />
                      <Skeleton animation="wave" className="h-4 w-3/4" />
                    </div>
                    <div className="border rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium mb-2">None</p>
                      <Skeleton animation="none" className="h-4 w-full" />
                      <Skeleton animation="none" className="h-4 w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkeletonDemo;
