'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/services/NotificationService';
import type { 
  Notification
} from '@/types/supabase.types';
import type { 
  NotificationPreferences, 
  QueuedNotification, 
  NotificationType 
} from '@/types/notifications.types';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearAllRead: () => Promise<void>;
  
  // Preferences
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  
  // Queue management
  sendNotification: (notification: Omit<QueuedNotification, 'priority'>) => Promise<void>;
  
  // Real-time
  subscribeToNotifications: () => void;
  unsubscribeFromNotifications: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

  const supabase = createBrowserClient();

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Load initial data
  useEffect(() => {
    if (user) {
      loadNotifications();
      loadPreferences();
      subscribeToNotifications();
    }

    return () => {
      unsubscribeFromNotifications();
    };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // Not found error
        throw fetchError;
      }

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences
        const defaultPrefs = {
          user_id: user.id,
          enabled: true,
          preferred_time: '09:00',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          daily_reminders: true,
          progress_updates: true,
          competition_start: true,
          competition_ending: true,
          competition_completed: true,
          new_messages: true,
          leaderboard_changes: false,
          email_enabled: true,
          push_enabled: true,
          in_app_enabled: true,
          max_notifications_per_day: 5,
          digest_frequency: 'weekly' as const,
          batch_similar_notifications: true,
          priority_competitions: [],
          muted_competitions: []
        };

        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) throw createError;
        setPreferences(newPrefs);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true, updated_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');
    }
  }, [user?.id, supabase]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .in('id', unreadIds)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, updated_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Failed to mark notifications as read');
    }
  }, [user, notifications, supabase]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification');
    }
  }, [user?.id, supabase]);

  const clearAllRead = useCallback(async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('is_read', true);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (err) {
      console.error('Error clearing read notifications:', err);
      setError('Failed to clear notifications');
    }
  }, [user, supabase]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!user || !preferences) return;

    try {
      setError(null);
      const updatedPrefs = { 
        ...preferences, 
        ...updates, 
        updated_at: new Date().toISOString() 
      };

      const { error } = await supabase
        .from('notification_preferences')
        .update(updatedPrefs)
        .eq('id', preferences.id);

      if (error) throw error;

      setPreferences(updatedPrefs);
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
    }
  }, [user, preferences, supabase]);

  const sendNotification = useCallback(async (notification: Omit<QueuedNotification, 'priority'>) => {
    if (!user) return;

    try {
      await notificationService.queueNotification(user.id, notification);
    } catch (err) {
      console.error('Error sending notification:', err);
      setError('Failed to send notification');
    }
  }, [user]);

  const subscribeToNotifications = useCallback(() => {
    if (!user || subscription) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new notification
            setNotifications(prev => [payload.new as Notification, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing notification
            setNotifications(prev => 
              prev.map(n => 
                n.id === payload.new.id 
                  ? payload.new as Notification 
                  : n
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted notification
            setNotifications(prev => 
              prev.filter(n => n.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    setSubscription(channel);
  }, [user, subscription, supabase]);

  const unsubscribeFromNotifications = useCallback(() => {
    if (subscription) {
      subscription.unsubscribe();
      setSubscription(null);
    }
  }, [subscription]);

  return {
    notifications,
    unreadCount,
    preferences,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllRead,
    updatePreferences,
    sendNotification,
    subscribeToNotifications,
    unsubscribeFromNotifications
  };
}