import { createBrowserClient } from '@/lib/supabase';
import type { 
  NotificationPreferences, 
  NotificationQueue, 
  QueuedNotification, 
  NotificationType,
  NotificationDigest,
  CompetitionSummary 
} from '@/types/notifications.types';

export class NotificationService {
  private static instance: NotificationService;
  private supabase = createBrowserClient();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Queue a notification for a user, applying grouping and batching rules
   */
  async queueNotification(
    userId: string,
    notification: Omit<QueuedNotification, 'priority'>
  ): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      if (!preferences || !preferences.enabled) return;

      // Check if this type of notification is enabled
      if (!this.isNotificationTypeEnabled(notification.type, preferences)) return;

      // Check if competition is muted
      if (notification.competition_id && 
          preferences.muted_competitions.includes(notification.competition_id)) {
        // Only send critical notifications for muted competitions
        if (!this.isCriticalNotification(notification.type)) return;
      }

      // Determine priority
      const priority = this.determineNotificationPriority(notification, preferences);
      const queuedNotification: QueuedNotification = { ...notification, priority };

      // Check daily limits (except for priority competitions)
      if (notification.competition_id && 
          !preferences.priority_competitions.includes(notification.competition_id)) {
        const todayCount = await this.getTodayNotificationCount(userId);
        if (todayCount >= preferences.max_notifications_per_day) {
          // Queue for digest instead
          await this.addToDigest(userId, queuedNotification);
          return;
        }
      }

      // Handle batching
      if (preferences.batch_similar_notifications) {
        await this.addToBatch(userId, queuedNotification, preferences);
      } else {
        await this.sendImmediately(userId, queuedNotification, preferences);
      }

    } catch (error) {
      console.error('Error queueing notification:', error);
    }
  }

  /**
   * Send notifications immediately or batch them based on preferences
   */
  private async addToBatch(
    userId: string,
    notification: QueuedNotification,
    preferences: NotificationPreferences
  ): Promise<void> {
    const scheduledTime = this.calculateScheduledTime(preferences);
    
    // Check if there's an existing batch for this time
    const { data: existingQueue } = await this.supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('scheduled_for', new Date().toISOString().split('T')[0]) // Today
      .single();

    if (existingQueue) {
      // Add to existing batch
      const updatedNotifications = [...existingQueue.notifications, notification];
      
      // Group similar notifications
      const groupedNotifications = this.groupSimilarNotifications(updatedNotifications);
      
      await this.supabase
        .from('notification_queue')
        .update({ 
          notifications: groupedNotifications,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingQueue.id);
    } else {
      // Create new batch
      await this.supabase
        .from('notification_queue')
        .insert({
          user_id: userId,
          notifications: [notification],
          scheduled_for: scheduledTime,
          status: 'pending'
        });
    }
  }

  /**
   * Group similar notifications to reduce noise
   */
  private groupSimilarNotifications(notifications: QueuedNotification[]): QueuedNotification[] {
    const grouped = new Map<string, QueuedNotification[]>();

    // Group by type and competition
    notifications.forEach(notification => {
      const key = `${notification.type}_${notification.competition_id || 'global'}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(notification);
    });

    const result: QueuedNotification[] = [];

    grouped.forEach((notifications, key) => {
      if (notifications.length === 1) {
        result.push(notifications[0]);
      } else {
        // Create grouped notification
        const groupedNotification = this.createGroupedNotification(notifications);
        result.push(groupedNotification);
      }
    });

    return result;
  }

  /**
   * Create a single notification from multiple similar notifications
   */
  private createGroupedNotification(notifications: QueuedNotification[]): QueuedNotification {
    const first = notifications[0];
    const count = notifications.length;
    const competitions = [...new Set(notifications.map(n => n.competition_name).filter(Boolean))];
    
    let title: string;
    let message: string;

    switch (first.type) {
      case 'daily_reminder':
        title = count > 1 ? `${count} Competition Reminders` : first.title;
        message = count > 1 
          ? `You have ${count} competitions waiting for your progress update`
          : first.message;
        break;
      
      case 'new_message':
        title = count > 1 ? `${count} New Messages` : first.title;
        message = count > 1
          ? `You have ${count} new messages across ${competitions.length} competition${competitions.length > 1 ? 's' : ''}`
          : first.message;
        break;
      
      case 'rank_change':
        title = count > 1 ? `Ranking Updates` : first.title;
        message = count > 1
          ? `Your ranking changed in ${competitions.length} competition${competitions.length > 1 ? 's' : ''}`
          : first.message;
        break;
      
      default:
        title = first.title;
        message = count > 1 
          ? `${count} updates across your competitions`
          : first.message;
    }

    return {
      type: first.type,
      priority: Math.max(...notifications.map(n => this.getPriorityValue(n.priority))) > 1 ? 'high' : first.priority,
      title,
      message,
      action_url: count > 1 ? '/competitions' : first.action_url,
      data: {
        grouped: true,
        count,
        competitions,
        original_notifications: notifications.map(n => n.data)
      }
    };
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * Process queued notifications and send them
   */
  async processNotificationQueue(): Promise<void> {
    try {
      const now = new Date();
      
      const { data: pendingQueues, error } = await this.supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString());

      if (error || !pendingQueues) return;

      for (const queue of pendingQueues) {
        await this.sendQueuedNotifications(queue);
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    }
  }

  /**
   * Send all notifications in a queue
   */
  private async sendQueuedNotifications(queue: NotificationQueue): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(queue.user_id);
      if (!preferences) return;

      for (const notification of queue.notifications) {
        await this.sendNotificationViaChannels(queue.user_id, notification, preferences);
      }

      // Mark queue as sent
      await this.supabase
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', queue.id);

    } catch (error) {
      console.error('Error sending queued notifications:', error);
      
      // Mark as failed
      await this.supabase
        .from('notification_queue')
        .update({ status: 'failed' })
        .eq('id', queue.id);
    }
  }

  /**
   * Send notification through enabled channels
   */
  private async sendNotificationViaChannels(
    userId: string,
    notification: QueuedNotification,
    preferences: NotificationPreferences
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    // In-app notification
    if (preferences.in_app_enabled) {
      promises.push(this.createInAppNotification(userId, notification));
    }

    // Email notification
    if (preferences.email_enabled) {
      promises.push(this.sendEmailNotification(userId, notification));
    }

    // Push notification
    if (preferences.push_enabled) {
      promises.push(this.sendPushNotification(userId, notification));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    notification: QueuedNotification
  ): Promise<void> {
    await this.supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        action_url: notification.action_url,
        is_read: false
      });
  }

  /**
   * Send email notification via Novu
   */
  private async sendEmailNotification(
    userId: string,
    notification: QueuedNotification
  ): Promise<void> {
    // Import your existing email notifications utility
    const { EmailNotifications } = await import('@/utils/emailNotifications');

    // Map notification types to your existing Novu workflows
    switch (notification.type) {
      case 'new_message':
        await EmailNotifications.newCompetitionMessage(userId, {
          senderName: notification.metadata?.senderName || 'Someone',
          competitionName: notification.competition_name || 'Competition',
          messageText: notification.message,
          competitionId: notification.competition_id || '',
          messageId: notification.metadata?.messageId || ''
        });
        break;

      case 'daily_reminder':
        await EmailNotifications.dailyCompetitionReminder(userId, {
          userName: notification.metadata?.userName || 'User',
          competitionName: notification.competition_name || 'Competition',
          competitionId: notification.competition_id || '',
          daysRemaining: notification.metadata?.daysRemaining || 0
        });
        break;

      case 'competition_start':
      case 'competition_ending':
      case 'progress_update':
        // Use generic workflow or create specific ones
        await EmailNotifications.competitionStandingsUpdate(userId, {
          competitionName: notification.competition_name || 'Competition',
          competitionId: notification.competition_id || '',
          rank: notification.metadata?.rank || 0,
          totalParticipants: notification.metadata?.totalParticipants || 0,
          progressPercentage: notification.metadata?.progressPercentage || 0
        });
        break;

      default:
        // Fallback to a generic notification workflow
        const { sendEmailNotification } = await import('@/utils/emailNotifications');
        await sendEmailNotification({
          workflowId: 'generic-notification',
          subscriberId: userId,
          payload: {
            title: notification.title,
            message: notification.message,
            actionUrl: notification.action_url,
            competitionName: notification.competition_name,
            type: notification.type
          }
        });
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    userId: string,
    notification: QueuedNotification
  ): Promise<void> {
    // Implementation would depend on your push notification service
    // This is a placeholder for the push notification logic
    console.log('Sending push notification:', { userId, notification });
  }

  /**
   * Calculate when notification should be sent based on user preferences
   */
  private calculateScheduledTime(preferences: NotificationPreferences): string {
    const [hours, minutes] = preferences.preferred_time.split(':').map(Number);
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);
    
    // If preferred time has passed today, schedule for tomorrow
    if (scheduledDate < new Date()) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    
    return scheduledDate.toISOString();
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

  private async getTodayNotificationCount(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    
    const { count } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`);

    return count || 0;
  }

  private async addToDigest(userId: string, notification: QueuedNotification): Promise<void> {
    // Add notification to digest queue for later processing
    // Implementation depends on your digest system
    console.log('Adding to digest:', { userId, notification });
  }

  private async sendImmediately(
    userId: string,
    notification: QueuedNotification,
    preferences: NotificationPreferences
  ): Promise<void> {
    await this.sendNotificationViaChannels(userId, notification, preferences);
  }

  private isNotificationTypeEnabled(type: NotificationType, preferences: NotificationPreferences): boolean {
    const typeMap: Record<NotificationType, keyof NotificationPreferences> = {
      'daily_reminder': 'daily_reminders',
      'progress_update': 'progress_updates',
      'competition_start': 'competition_start',
      'competition_ending': 'competition_ending',
      'competition_completed': 'competition_completed',
      'new_message': 'new_messages',
      'rank_change': 'leaderboard_changes',
      'milestone_reached': 'progress_updates',
      'weekly_summary': 'progress_updates'
    };

    const prefKey = typeMap[type];
    return prefKey ? preferences[prefKey] as boolean : true;
  }

  private isCriticalNotification(type: NotificationType): boolean {
    return ['competition_completed', 'competition_start'].includes(type);
  }

  private determineNotificationPriority(
    notification: Omit<QueuedNotification, 'priority'>,
    preferences: NotificationPreferences
  ): 'low' | 'medium' | 'high' {
    // Priority competitions get high priority
    if (notification.competition_id && 
        preferences.priority_competitions.includes(notification.competition_id)) {
      return 'high';
    }

    // Critical notifications get high priority
    if (this.isCriticalNotification(notification.type)) {
      return 'high';
    }

    // Daily reminders get medium priority
    if (notification.type === 'daily_reminder') {
      return 'medium';
    }

    return 'low';
  }

  private getEmailWorkflowId(type: NotificationType): string {
    const workflowMap: Record<NotificationType, string> = {
      'daily_reminder': 'daily-competition-reminder',
      'progress_update': 'progress-update',
      'competition_start': 'competition-started',
      'competition_ending': 'competition-ending-soon',
      'competition_completed': 'competition-ended',
      'new_message': 'new-competition-message',
      'rank_change': 'rank-change-notification',
      'milestone_reached': 'milestone-reached',
      'weekly_summary': 'weekly-summary'
    };

    return workflowMap[type] || 'general-notification';
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();