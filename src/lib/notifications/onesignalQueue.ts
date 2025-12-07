import { createClient, SupabaseClient } from '@supabase/supabase-js';

type QueueError = { notificationId: string; error: string };

export type ProcessQueueResult = {
  success: boolean;
  message: string;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
  errors?: QueueError[];
};

type ProcessQueueOptions = {
  batchSize?: number;
  supabaseClient?: SupabaseClient;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  onesignalAppId?: string;
  onesignalRestApiKey?: string;
};

/**
 * Core OneSignal queue processor used by both the public API route and internal jobs.
 * Handles fetching queued notifications, applying user preferences, sending via OneSignal,
 * and marking processed/failed/skipped notifications accordingly.
 */
export async function processOneSignalQueue(options: ProcessQueueOptions = {}): Promise<ProcessQueueResult> {
  const batchSize = Math.min(Math.max(Number(options.batchSize ?? 50) || 50, 1), 100);

  const onesignalAppId = options.onesignalAppId ?? process.env.ONESIGNAL_APP_ID;
  const onesignalRestApiKey = options.onesignalRestApiKey ?? process.env.ONESIGNAL_REST_API_KEY;

  if (!onesignalAppId || !onesignalRestApiKey) {
    throw new Error('ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not configured');
  }

  const supabaseUrl = options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = options.supabaseServiceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase =
    options.supabaseClient ??
    (() => {
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL or service role key not configured');
      }
      return createClient(supabaseUrl, supabaseServiceKey);
    })();

  const { data: notifications, error: fetchError } = await supabase
    .from('notifications')
    .select('*')
    .is('push_sent_at', null)
    .eq('is_read', false)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
  }

  if (!notifications || notifications.length === 0) {
    return {
      success: true,
      message: 'No notifications to process',
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };
  }

  const notificationsByUser = notifications.reduce((acc: Record<string, typeof notifications>, notif) => {
    if (!acc[notif.user_id]) {
      acc[notif.user_id] = [];
    }
    acc[notif.user_id].push(notif);
    return acc;
  }, {} as Record<string, typeof notifications>);

  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as QueueError[],
  };

  for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
    try {
      let { data: prefs, error: prefsError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (prefsError && (prefsError as { code?: string }).code === 'PGRST116') {
        const defaultPrefs = {
          user_id: userId,
          enabled: true,
          preferred_time: '09:00',
          timezone: 'UTC',
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
          muted_competitions: [],
        };

        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) {
          results.failed += userNotifications.length;
          continue;
        }

        prefs = newPrefs;
      } else if (prefsError) {
        results.failed += userNotifications.length;
        continue;
      }

      if (!prefs.enabled || !prefs.push_enabled) {
        results.skipped += userNotifications.length;
        await supabase
          .from('notifications')
          .update({ push_sent_at: new Date().toISOString() })
          .in('id', userNotifications.map((n) => n.id));
        continue;
      }

      const notificationsToSend = userNotifications.filter((notif) => {
        switch (notif.type) {
          case 'daily_summary':
            return prefs.daily_reminders !== false;
          case 'new_message':
            return prefs.new_messages !== false;
          case 'achievement_earned':
          case 'collaboration_milestone':
            return prefs.progress_updates !== false;
          default:
            return true;
        }
      });

      if (notificationsToSend.length === 0) {
        results.skipped += userNotifications.length;
        await supabase
          .from('notifications')
          .update({ push_sent_at: new Date().toISOString() })
          .in('id', userNotifications.map((n) => n.id));
        continue;
      }

      for (const notification of notificationsToSend) {
        try {
          const onesignalPayload = {
            app_id: onesignalAppId,
            include_external_user_ids: [userId],
            channel_for_external_user_ids: 'push',
            headings: { en: notification.title },
            contents: { en: notification.message },
            data: {
              notificationId: notification.id,
              type: notification.type,
              actionUrl: notification.action_url || null,
              ...(notification.data || {}),
            },
          };

          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${onesignalRestApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(onesignalPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            results.failed++;
            results.errors.push({
              notificationId: notification.id,
              error: errorText,
            });
          } else {
            results.sent++;
            await supabase
              .from('notifications')
              .update({ push_sent_at: new Date().toISOString() })
              .eq('id', notification.id);
          }

          results.processed++;
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          results.failed++;
          results.errors.push({
            notificationId: notification.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const skippedIds = userNotifications
        .filter((n) => !notificationsToSend.some((sent) => sent.id === n.id))
        .map((n) => n.id);

      if (skippedIds.length > 0) {
        await supabase
          .from('notifications')
          .update({ push_sent_at: new Date().toISOString() })
          .in('id', skippedIds);
        results.skipped += skippedIds.length;
      }
    } catch (error) {
      results.failed += userNotifications.length;
    }
  }

  return {
    success: true,
    message: `Processed ${results.processed} notifications: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`,
    processed: results.processed,
    sent: results.sent,
    skipped: results.skipped,
    failed: results.failed,
    total: notifications.length,
    errors: results.errors.length > 0 ? results.errors : undefined,
  };
}

