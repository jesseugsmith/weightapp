// Types for notification preferences and settings

export interface NotificationPreferences {
  id: string;
  user_id: string;
  
  // Global notification settings
  enabled: boolean;
  preferred_time: string; // Format: "HH:MM"
  timezone: string;
  
  // Notification types preferences
  daily_reminders: boolean;
  progress_updates: boolean;
  competition_start: boolean;
  competition_ending: boolean;
  competition_completed: boolean;
  new_messages: boolean;
  leaderboard_changes: boolean;
  
  // Delivery preferences
  email_enabled: boolean;
  push_enabled: boolean;
  in_app_enabled: boolean;
  
  // Frequency settings
  max_notifications_per_day: number;
  digest_frequency: 'daily' | 'weekly' | 'disabled';
  batch_similar_notifications: boolean;
  
  // Competition-specific settings
  priority_competitions: string[]; // Competition IDs that get all notifications
  muted_competitions: string[]; // Competition IDs that are muted
  
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  user_id: string;
  competition_id: string | null; // null for global rules
  notification_type: NotificationType;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high';
  conditions?: Record<string, any>; // e.g., { "rank_change": 2 }
}

export type NotificationType = 
  | 'daily_reminder'
  | 'progress_update' 
  | 'competition_start'
  | 'competition_ending'
  | 'competition_completed'
  | 'new_message'
  | 'rank_change'
  | 'milestone_reached'
  | 'weekly_summary';

export interface NotificationQueue {
  id: string;
  user_id: string;
  notifications: QueuedNotification[];
  scheduled_for: string;
  status: 'pending' | 'sent' | 'failed';
  created_at: string;
}

export interface QueuedNotification {
  type: NotificationType;
  competition_id?: string;
  competition_name?: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  action_url?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>; // Additional data for Novu workflows
}

export interface NotificationDigest {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  digest_type: 'daily' | 'weekly';
  competitions_summary: CompetitionSummary[];
  key_activities: ActivitySummary[];
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionSummary {
  competition_id: string;
  competition_name: string;
  status: string;
  current_rank: number;
  rank_change: number;
  progress_change: number;
  days_remaining: number;
  new_messages: number;
  participants_count: number;
}

export interface ActivitySummary {
  type: 'weight_logged' | 'rank_change' | 'competition_joined' | 'message_received';
  count: number;
  details: string;
  competitions_affected: string[];
}