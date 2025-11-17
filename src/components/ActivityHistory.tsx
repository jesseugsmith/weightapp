'use client';

import { useEffect, useState } from 'react';
import { ActivityService } from '@/lib/services/activity-service';
import type { ActivityEntry } from '@/types/supabase.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityHistorySkeleton } from './skeletons';

interface ActivityHistoryProps {
  userId: string;
  activityType?: ActivityEntry['activity_type'];
  limit?: number;
}

export default function ActivityHistory({ userId, activityType, limit = 10 }: ActivityHistoryProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;
      if (activityType) {
        result = await ActivityService.getActivityEntries(activityType, userId, limit);
      } else {
        // Get all activity types
        const supportedTypes = ActivityService.getSupportedActivityTypes();
        const allEntries: ActivityEntry[] = [];
        
        for (const type of supportedTypes) {
          const typeResult = await ActivityService.getActivityEntries(type.type, userId, limit);
          if (typeResult.success && typeResult.data) {
            allEntries.push(...typeResult.data);
          }
        }
        
        // Sort by date descending
        allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        result = { success: true, data: allEntries.slice(0, limit), error: null };
      }

      if (result.success) {
        setEntries(result.data || []);
      } else {
        setError(result.error || 'Failed to load activities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [userId, activityType, limit]);

  const getActivityConfig = (type: ActivityEntry['activity_type']) => {
    return ActivityService.getActivityConfig(type);
  };

  const formatValue = (entry: ActivityEntry) => {
    const config = getActivityConfig(entry.activity_type);
    if (!config) return entry.value.toString();
    
    if (entry.activity_type === 'steps' || entry.activity_type === 'calories') {
      return entry.value.toLocaleString(); // Add commas for large numbers
    }
    
    return entry.value.toFixed(1);
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const entryDate = new Date(date);
    const diffMs = now.getTime() - entryDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return <ActivityHistorySkeleton itemCount={limit} />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {activityType 
            ? `${getActivityConfig(activityType)?.label || activityType} History`
            : 'Activity History'
          }
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No activities logged yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const config = getActivityConfig(entry.activity_type);
              return (
                <div key={entry.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{config?.icon || '📊'}</span>
                    <div>
                      <div className="font-medium">
                        {formatValue(entry)} {entry.unit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {config?.label || entry.activity_type}
                        {entry.notes && ` • ${entry.notes}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground px-2 py-1 bg-background rounded border">
                      {formatRelativeTime(entry.date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}