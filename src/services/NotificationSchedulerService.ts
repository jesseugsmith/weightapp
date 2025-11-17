import { createBrowserClient } from '@/lib/supabase';
import { notificationService } from './NotificationService';
import type { 
  NotificationPreferences, 
  QueuedNotification,
  NotificationType 
} from '@/types/notifications.types';

interface ScheduledNotification {
  id: string;
  user_id: string;
  notification: QueuedNotification;
  scheduled_for: string;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface UserActivity {
  user_id: string;
  last_active: string;
  typical_active_hours: number[];
  timezone: string;
  notification_frequency_preference: 'immediate' | 'batched' | 'digest';
}

export class NotificationSchedulerService {
  private static instance: NotificationSchedulerService;
  private supabase = createBrowserClient();
  private isProcessing = false;

  static getInstance(): NotificationSchedulerService {
    if (!NotificationSchedulerService.instance) {
      NotificationSchedulerService.instance = new NotificationSchedulerService();
    }
    return NotificationSchedulerService.instance;
  }

  /**
   * Schedule a notification with intelligent timing
   */
  async scheduleNotification(
    userId: string,
    notification: Omit<QueuedNotification, 'priority'>,
    options?: {
      delay?: number; // Minutes to delay
      respectQuietHours?: boolean;
      urgency?: 'low' | 'normal' | 'high';
    }
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences || !preferences.enabled) return;

      const userActivity = await this.getUserActivity(userId);
      const scheduledTime = await this.calculateOptimalSendTime(
        userId,
        notification,
        preferences,
        userActivity,
        options
      );

      // Check if we should send immediately or schedule
      const now = new Date();
      const sendTime = new Date(scheduledTime);

      if (sendTime <= now || options?.urgency === 'high') {
        // Send immediately for urgent notifications or if scheduled time has passed
        await notificationService.queueNotification(userId, notification);
      } else {
        // Schedule for later
        await this.addToScheduledNotifications({
          user_id: userId,
          notification: { ...notification, priority: 'medium' },
          scheduled_for: scheduledTime,
          attempts: 0,
          max_attempts: 3,
          status: 'pending'
        });
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  }

  /**
   * Calculate optimal send time based on user behavior and preferences
   */
  private async calculateOptimalSendTime(
    userId: string,
    notification: Omit<QueuedNotification, 'priority'>,
    preferences: NotificationPreferences,
    userActivity: UserActivity | null,
    options?: {
      delay?: number;
      respectQuietHours?: boolean;
      urgency?: 'low' | 'normal' | 'high';
    }
  ): Promise<string> {
    const now = new Date();
    let targetTime = new Date(now);

    // Apply initial delay if specified
    if (options?.delay) {
      targetTime.setMinutes(targetTime.getMinutes() + options.delay);
    }

    // Respect user's preferred notification time for non-urgent notifications
    if (options?.urgency !== 'high') {
      const [preferredHour, preferredMinute] = preferences.preferred_time.split(':').map(Number);
      
      // If current time is before preferred time today, schedule for preferred time
      const preferredTimeToday = new Date(targetTime);
      preferredTimeToday.setHours(preferredHour, preferredMinute, 0, 0);
      
      if (targetTime < preferredTimeToday) {
        targetTime = preferredTimeToday;
      } else {
        // Schedule for preferred time tomorrow
        const preferredTimeTomorrow = new Date(preferredTimeToday);
        preferredTimeTomorrow.setDate(preferredTimeTomorrow.getDate() + 1);
        targetTime = preferredTimeTomorrow;
      }
    }

    // Respect quiet hours (10 PM - 7 AM) unless urgent
    if (options?.respectQuietHours !== false && options?.urgency !== 'high') {
      targetTime = this.avoidQuietHours(targetTime);
    }

    // Avoid sending too many notifications in a short period
    const recentNotificationCount = await this.getRecentNotificationCount(userId, 60); // Last hour
    if (recentNotificationCount >= 3 && options?.urgency !== 'high') {
      // Delay by 30-60 minutes to avoid overwhelming the user
      const delayMinutes = 30 + Math.random() * 30;
      targetTime.setMinutes(targetTime.getMinutes() + delayMinutes);
    }

    // Use user activity patterns to optimize timing
    if (userActivity && options?.urgency !== 'high') {
      targetTime = this.optimizeForUserActivity(targetTime, userActivity);
    }

    // Apply notification type specific timing rules
    targetTime = this.applyTypeSpecificTiming(targetTime, notification.type);

    return targetTime.toISOString();
  }

  /**
   * Avoid quiet hours (10 PM - 7 AM)
   */
  private avoidQuietHours(targetTime: Date): Date {
    const hour = targetTime.getHours();
    
    if (hour >= 22 || hour < 7) {
      // Move to 7 AM of the appropriate day
      const adjustedTime = new Date(targetTime);
      if (hour >= 22) {
        adjustedTime.setDate(adjustedTime.getDate() + 1);
      }
      adjustedTime.setHours(7, 0, 0, 0);
      return adjustedTime;
    }
    
    return targetTime;
  }

  /**
   * Optimize timing based on user activity patterns
   */
  private optimizeForUserActivity(targetTime: Date, userActivity: UserActivity): Date {
    const targetHour = targetTime.getHours();
    
    // If user has typical active hours, try to send during those times
    if (userActivity.typical_active_hours.length > 0) {
      const isActiveHour = userActivity.typical_active_hours.includes(targetHour);
      
      if (!isActiveHour) {
        // Find the next closest active hour
        const sortedActiveHours = userActivity.typical_active_hours.sort((a, b) => a - b);
        let nextActiveHour = sortedActiveHours.find(hour => hour > targetHour);
        
        if (!nextActiveHour) {
          // Wrap to tomorrow's first active hour
          nextActiveHour = sortedActiveHours[0];
          targetTime.setDate(targetTime.getDate() + 1);
        }
        
        targetTime.setHours(nextActiveHour, 0, 0, 0);
      }
    }
    
    return targetTime;
  }

  /**
   * Apply notification type specific timing rules
   */
  private applyTypeSpecificTiming(targetTime: Date, type: NotificationType): Date {
    const now = new Date();
    
    switch (type) {
      case 'daily_reminder':
        // Daily reminders should be sent at a consistent time, prefer morning
        const hour = targetTime.getHours();
        if (hour < 7 || hour > 10) {
          targetTime.setHours(9, 0, 0, 0);
        }
        break;
        
      case 'competition_ending':
        // Competition ending notifications are time-sensitive
        // Don't delay these too much
        if (targetTime.getTime() - now.getTime() > 2 * 60 * 60 * 1000) { // 2 hours
          targetTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes delay max
        }
        break;
        
      case 'new_message':
        // Messages should be delivered relatively quickly
        if (targetTime.getTime() - now.getTime() > 30 * 60 * 1000) { // 30 minutes
          targetTime = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes delay max
        }
        break;
        
      case 'weekly_summary':
        // Weekly summaries should be sent on weekends, preferably Sunday morning
        const dayOfWeek = targetTime.getDay();
        if (dayOfWeek !== 0) { // Not Sunday
          const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
          targetTime.setDate(targetTime.getDate() + daysUntilSunday);
          targetTime.setHours(9, 0, 0, 0);
        }
        break;
    }
    
    return targetTime;
  }

  /**
   * Process scheduled notifications that are ready to be sent
   */
  async processScheduledNotifications(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const now = new Date();
      
      const { data: scheduledNotifications, error } = await this.supabase
        .from('scheduled_notifications')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(50);

      if (error || !scheduledNotifications) return;

      for (const scheduled of scheduledNotifications) {
        await this.processScheduledNotification(scheduled);
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single scheduled notification
   */
  private async processScheduledNotification(scheduled: ScheduledNotification): Promise<void> {
    try {
      // Check if user preferences still allow this notification
      const preferences = await this.getUserPreferences(scheduled.user_id);
      if (!preferences || !preferences.enabled) {
        await this.markScheduledNotificationAsCancelled(scheduled.id);
        return;
      }

      // Send the notification
      await notificationService.queueNotification(scheduled.user_id, scheduled.notification);
      
      // Mark as sent
      await this.supabase
        .from('scheduled_notifications')
        .update({ 
          status: 'sent', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', scheduled.id);

    } catch (error) {
      console.error('Error processing scheduled notification:', error);
      
      // Increment attempts and reschedule or mark as failed
      const newAttempts = scheduled.attempts + 1;
      
      if (newAttempts >= scheduled.max_attempts) {
        await this.supabase
          .from('scheduled_notifications')
          .update({ 
            status: 'failed', 
            attempts: newAttempts,
            updated_at: new Date().toISOString() 
          })
          .eq('id', scheduled.id);
      } else {
        // Reschedule for 15 minutes later
        const newScheduledTime = new Date();
        newScheduledTime.setMinutes(newScheduledTime.getMinutes() + 15);
        
        await this.supabase
          .from('scheduled_notifications')
          .update({ 
            attempts: newAttempts,
            scheduled_for: newScheduledTime.toISOString(),
            updated_at: new Date().toISOString() 
          })
          .eq('id', scheduled.id);
      }
    }
  }

  /**
   * Track user activity to improve notification timing
   */
  async trackUserActivity(userId: string): Promise<void> {
    try {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Get existing activity data
      const { data: existingActivity } = await this.supabase
        .from('user_activity')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingActivity) {
        // Update typical active hours
        const activeHours = new Set(existingActivity.typical_active_hours);
        activeHours.add(currentHour);
        
        // Keep only recent active hours (limit to prevent indefinite growth)
        const activeHoursArray = Array.from(activeHours).slice(-50);
        
        await this.supabase
          .from('user_activity')
          .update({
            last_active: now.toISOString(),
            typical_active_hours: activeHoursArray,
            updated_at: now.toISOString()
          })
          .eq('user_id', userId);
      } else {
        // Create new activity record
        await this.supabase
          .from('user_activity')
          .insert({
            user_id: userId,
            last_active: now.toISOString(),
            typical_active_hours: [currentHour],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            notification_frequency_preference: 'batched'
          });
      }
    } catch (error) {
      console.error('Error tracking user activity:', error);
    }
  }

  /**
   * Helper methods
   */
  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return error ? null : data;
  }

  private async getUserActivity(userId: string): Promise<UserActivity | null> {
    const { data, error } = await this.supabase
      .from('user_activity')
      .select('*')
      .eq('user_id', userId)
      .single();

    return error ? null : data;
  }

  private async getRecentNotificationCount(userId: string, minutesBack: number): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - minutesBack);

    const { count } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', cutoffTime.toISOString());

    return count || 0;
  }

  private async addToScheduledNotifications(
    notification: Omit<ScheduledNotification, 'id' | 'created_at' | 'updated_at'>
  ): Promise<void> {
    await this.supabase
      .from('scheduled_notifications')
      .insert({
        ...notification,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }

  private async markScheduledNotificationAsCancelled(id: string): Promise<void> {
    await this.supabase
      .from('scheduled_notifications')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);
  }

  /**
   * Start the notification processing scheduler
   */
  startScheduler(): void {
    // Process scheduled notifications every minute
    setInterval(() => {
      this.processScheduledNotifications();
    }, 60 * 1000);

    console.log('✅ Notification scheduler started');
  }
}

// Export singleton instance
export const notificationScheduler = NotificationSchedulerService.getInstance();