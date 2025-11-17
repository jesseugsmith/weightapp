"use client";

import { useAuth } from "@/hooks/useAuth";
import { MessagingService } from "@/lib/services/messaging-service";
import { createBrowserClient } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const loadTotalUnreadCount = useCallback(async () => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    try {
      const supabase = createBrowserClient();

      // Get competitions user is participating in
      const { data: participations, error: participationsError } = await supabase
        .from('competition_participants')
        .select('competition_id')
        .eq('user_id', user.id);

      if (participationsError || !participations) {
        setTotalUnreadCount(0);
        return;
      }

      // Get unread count for each competition
      const unreadPromises = participations.map(async (participation) => {
        try {
          const response = await MessagingService.getUnreadCount(participation.competition_id);
          return response.success ? response.data || 0 : 0;
        } catch (err) {
          console.warn('Failed to get unread count for competition:', participation.competition_id, err);
          return 0;
        }
      });

      const unreadCounts = await Promise.all(unreadPromises);
      const total = unreadCounts.reduce((sum, count) => sum + count, 0);
      setTotalUnreadCount(total);
    } catch (err) {
      console.warn('Failed to load total unread count:', err);
      setTotalUnreadCount(0);
    }
  }, [user]);

  useEffect(() => {
    loadTotalUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadTotalUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadTotalUnreadCount]);

  return { totalUnreadCount, refreshUnreadCount: loadTotalUnreadCount };
};

interface UnreadBadgeProps {
  count: number;
}

export const UnreadBadge: React.FC<UnreadBadgeProps> = ({ count }) => {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full ml-auto">
      {count > 99 ? '99+' : count}
    </span>
  );
};