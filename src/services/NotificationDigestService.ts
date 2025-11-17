import { createBrowserClient } from '@/lib/supabase';
import { notificationService } from './NotificationService';
import type { 
  NotificationDigest,
  CompetitionSummary,
  ActivitySummary,
  NotificationPreferences 
} from '@/types/notifications.types';

export class NotificationDigestService {
  private static instance: NotificationDigestService;
  private supabase = createBrowserClient();

  static getInstance(): NotificationDigestService {
    if (!NotificationDigestService.instance) {
      NotificationDigestService.instance = new NotificationDigestService();
    }
    return NotificationDigestService.instance;
  }

  /**
   * Generate and send daily digest for users
   */
  async generateDailyDigests(): Promise<void> {
    console.log('🌅 Generating daily digests...');
    
    try {
      const usersWithDailyDigest = await this.getUsersWithDigestPreference('daily');
      
      for (const user of usersWithDailyDigest) {
        await this.generateAndSendDigest(user.user_id, 'daily');
      }
      
      console.log(`✅ Generated daily digests for ${usersWithDailyDigest.length} users`);
    } catch (error) {
      console.error('Error generating daily digests:', error);
    }
  }

  /**
   * Generate and send weekly digest for users
   */
  async generateWeeklyDigests(): Promise<void> {
    console.log('📊 Generating weekly digests...');
    
    try {
      const usersWithWeeklyDigest = await this.getUsersWithDigestPreference('weekly');
      
      for (const user of usersWithWeeklyDigest) {
        await this.generateAndSendDigest(user.user_id, 'weekly');
      }
      
      console.log(`✅ Generated weekly digests for ${usersWithWeeklyDigest.length} users`);
    } catch (error) {
      console.error('Error generating weekly digests:', error);
    }
  }

  /**
   * Generate and send digest for a specific user
   */
  async generateAndSendDigest(
    userId: string, 
    digestType: 'daily' | 'weekly'
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      if (!preferences || !preferences.enabled) return;

      // Check if digest was already sent for this period
      const existingDigest = await this.getExistingDigest(userId, digestType);
      if (existingDigest) return;

      const { periodStart, periodEnd } = this.getDigestPeriod(digestType);
      
      // Generate digest content
      const competitionsSummary = await this.generateCompetitionsSummary(userId, periodStart, periodEnd);
      const keyActivities = await this.generateKeyActivities(userId, periodStart, periodEnd);

      // Only send digest if there's meaningful content
      if (competitionsSummary.length === 0 && keyActivities.length === 0) {
        console.log(`No activity for user ${userId}, skipping ${digestType} digest`);
        return;
      }

      // Create digest record
      const digest = await this.createDigestRecord({
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        digest_type: digestType,
        competitions_summary: competitionsSummary,
        key_activities: keyActivities
      });

      // Send digest notification
      await this.sendDigestNotification(userId, digest, preferences);

      // Mark digest as sent
      await this.markDigestAsSent(digest.id);

    } catch (error) {
      console.error(`Error generating ${digestType} digest for user ${userId}:`, error);
    }
  }

  /**
   * Generate competitions summary for the digest period
   */
  private async generateCompetitionsSummary(
    userId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<CompetitionSummary[]> {
    const { data: participations, error } = await this.supabase
      .from('competition_participants')
      .select(`
        *,
        competition:competition_id (
          id,
          name,
          status,
          end_date
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !participations) return [];

    const summaries: CompetitionSummary[] = [];

    for (const participation of participations) {
      const competition = participation.competition;
      if (!competition) continue;

      // Calculate days remaining
      const daysRemaining = Math.max(0, Math.ceil(
        (new Date(competition.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Get rank change during this period
      const rankChange = await this.calculateRankChange(
        participation.id, 
        periodStart, 
        periodEnd
      );

      // Get progress change (weight change)
      const progressChange = await this.calculateProgressChange(
        participation.id, 
        periodStart, 
        periodEnd
      );

      // Get new messages count
      const newMessages = await this.getNewMessagesCount(
        competition.id, 
        userId, 
        periodStart, 
        periodEnd
      );

      // Get total participants
      const { count: participantsCount } = await this.supabase
        .from('competition_participants')
        .select('*', { count: 'exact', head: true })
        .eq('competition_id', competition.id)
        .eq('is_active', true);

      summaries.push({
        competition_id: competition.id,
        competition_name: competition.name,
        status: competition.status,
        current_rank: participation.rank || 0,
        rank_change: rankChange,
        progress_change: progressChange,
        days_remaining: daysRemaining,
        new_messages: newMessages,
        participants_count: participantsCount || 0
      });
    }

    return summaries.filter(summary => 
      summary.rank_change !== 0 || 
      summary.progress_change !== 0 || 
      summary.new_messages > 0 ||
      summary.days_remaining <= 7 // Include competitions ending soon
    );
  }

  /**
   * Generate key activities summary
   */
  private async generateKeyActivities(
    userId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<ActivitySummary[]> {
    const activities: ActivitySummary[] = [];

    // Weight logs
    const { count: weightLogs } = await this.supabase
      .from('weight_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (weightLogs && weightLogs > 0) {
      activities.push({
        type: 'weight_logged',
        count: weightLogs,
        details: `You logged your weight ${weightLogs} time${weightLogs > 1 ? 's' : ''}`,
        competitions_affected: []
      });
    }

    // Rank changes
    const rankChanges = await this.getRankChangesInPeriod(userId, periodStart, periodEnd);
    if (rankChanges.length > 0) {
      const improvements = rankChanges.filter(change => change.rank_change > 0).length;
      activities.push({
        type: 'rank_change',
        count: rankChanges.length,
        details: improvements > 0 
          ? `Your ranking improved in ${improvements} competition${improvements > 1 ? 's' : ''}`
          : 'Your rankings changed across multiple competitions',
        competitions_affected: rankChanges.map(change => change.competition_name)
      });
    }

    // New competitions joined
    const { count: newJoins } = await this.supabase
      .from('competition_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('joined_at', periodStart)
      .lte('joined_at', periodEnd);

    if (newJoins && newJoins > 0) {
      activities.push({
        type: 'competition_joined',
        count: newJoins,
        details: `You joined ${newJoins} new competition${newJoins > 1 ? 's' : ''}`,
        competitions_affected: []
      });
    }

    // Messages received
    const messagesReceived = await this.getMessagesReceivedInPeriod(userId, periodStart, periodEnd);
    if (messagesReceived.length > 0) {
      activities.push({
        type: 'message_received',
        count: messagesReceived.length,
        details: `You received ${messagesReceived.length} message${messagesReceived.length > 1 ? 's' : ''} across your competitions`,
        competitions_affected: [...new Set(messagesReceived.map(msg => msg.competition_name))]
      });
    }

    return activities;
  }

  /**
   * Send digest as notification
   */
  private async sendDigestNotification(
    userId: string,
    digest: NotificationDigest,
    preferences: NotificationPreferences
  ): Promise<void> {
    const periodText = digest.digest_type === 'daily' ? 'Daily' : 'Weekly';
    const competitionsCount = digest.competitions_summary.length;
    const activitiesCount = digest.key_activities.reduce((sum, activity) => sum + activity.count, 0);

    const title = `${periodText} Competition Summary`;
    const message = competitionsCount > 0 
      ? `You have updates from ${competitionsCount} competition${competitionsCount > 1 ? 's' : ''} and ${activitiesCount} activities`
      : `Your ${digest.digest_type} summary is ready`;

    await notificationService.queueNotification(userId, {
      type: digest.digest_type === 'daily' ? 'daily_reminder' : 'weekly_summary',
      title,
      message,
      action_url: `/notifications/digest/${digest.id}`,
      data: {
        digest_id: digest.id,
        digest_type: digest.digest_type,
        competitions_count: competitionsCount,
        activities_count: activitiesCount
      }
    });
  }

  /**
   * Helper methods
   */
  private async getUsersWithDigestPreference(digestType: 'daily' | 'weekly'): Promise<{ user_id: string }[]> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('enabled', true)
      .eq('digest_frequency', digestType);

    return error ? [] : data;
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return error ? null : data;
  }

  private getDigestPeriod(digestType: 'daily' | 'weekly'): { periodStart: string; periodEnd: string } {
    const now = new Date();
    const periodEnd = now.toISOString();
    
    const periodStart = new Date(now);
    if (digestType === 'daily') {
      periodStart.setDate(periodStart.getDate() - 1);
    } else {
      periodStart.setDate(periodStart.getDate() - 7);
    }

    return { periodStart: periodStart.toISOString(), periodEnd };
  }

  private async getExistingDigest(userId: string, digestType: 'daily' | 'weekly'): Promise<any> {
    const { periodStart, periodEnd } = this.getDigestPeriod(digestType);
    
    const { data, error } = await this.supabase
      .from('notification_digests')
      .select('*')
      .eq('user_id', userId)
      .eq('digest_type', digestType)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .single();

    return error ? null : data;
  }

  private async createDigestRecord(digestData: Omit<NotificationDigest, 'id' | 'sent_at' | 'created_at' | 'updated_at'>): Promise<NotificationDigest> {
    const { data, error } = await this.supabase
      .from('notification_digests')
      .insert(digestData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async markDigestAsSent(digestId: string): Promise<void> {
    await this.supabase
      .from('notification_digests')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', digestId);
  }

  private async calculateRankChange(
    participationId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    // This would require tracking rank history
    // For now, return 0 as placeholder
    return 0;
  }

  private async calculateProgressChange(
    participationId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    // Calculate weight change during the period
    // This would need to fetch weight entries and calculate change
    return 0;
  }

  private async getNewMessagesCount(
    competitionId: string,
    userId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    const { count } = await this.supabase
      .from('competition_messages')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', competitionId)
      .neq('sender_id', userId) // Don't count user's own messages
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    return count || 0;
  }

  private async getRankChangesInPeriod(
    userId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<{ competition_name: string; rank_change: number }[]> {
    // This would require rank change tracking
    // For now, return empty array as placeholder
    return [];
  }

  private async getMessagesReceivedInPeriod(
    userId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<{ competition_name: string }[]> {
    const { data, error } = await this.supabase
      .from('competition_messages')
      .select(`
        competition:competition_id (name)
      `)
      .neq('sender_id', userId)
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    if (error || !data) return [];

    return data.map((item: any) => ({
      competition_name: item.competition?.name || 'Unknown Competition'
    }));
  }

  /**
   * Get digest content for display
   */
  async getDigestContent(digestId: string): Promise<NotificationDigest | null> {
    const { data, error } = await this.supabase
      .from('notification_digests')
      .select('*')
      .eq('id', digestId)
      .single();

    return error ? null : data;
  }

  /**
   * Start the digest scheduler
   */
  startDigestScheduler(): void {
    // Generate daily digests at 8 AM every day
    const dailyDigestHour = 8;
    
    // Generate weekly digests on Sunday at 9 AM
    const weeklyDigestDay = 0; // Sunday
    const weeklyDigestHour = 9;

    setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      // Daily digests
      if (currentHour === dailyDigestHour) {
        this.generateDailyDigests();
      }

      // Weekly digests
      if (currentDay === weeklyDigestDay && currentHour === weeklyDigestHour) {
        this.generateWeeklyDigests();
      }
    }, 60 * 60 * 1000); // Check every hour

    console.log('✅ Digest scheduler started');
  }
}

// Export singleton instance
export const digestService = NotificationDigestService.getInstance();