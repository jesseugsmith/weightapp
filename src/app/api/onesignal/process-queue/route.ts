import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API endpoint to process the notification queue and send to OneSignal
 * This endpoint reads unprocessed notifications (push_sent_at IS NULL) from the notifications table
 * and sends them via OneSignal REST API, then marks them as processed
 * 
 * Designed to be called by an external job management tool (e.g., Vercel Cron, GitHub Actions, etc.)
 * 
 * Authentication:
 * - Service role key via Authorization header: Bearer YOUR_SERVICE_ROLE_KEY
 * - Or CRON_SECRET for Vercel Cron: ?cron_secret=YOUR_SECRET or Authorization: Bearer YOUR_SECRET
 * 
 * Query Parameters:
 * - batchSize (optional): Number of notifications to process per request (default: 50, max: 100)
 * 
 * Example:
 * POST /api/onesignal/process-queue?batchSize=50
 * Headers: Authorization: Bearer YOUR_SERVICE_ROLE_KEY
 */
export async function POST(request: NextRequest) {
  try {
    // Get service role key from header or environment
    // Supports both Vercel Cron (CRON_SECRET via query param or header) and Supabase Cron (service role key)
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const cronSecretParam = searchParams.get('cron_secret');
    const cronSecret = process.env.CRON_SECRET;
    const serviceKey = authHeader?.replace('Bearer ', '') || process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Validate authentication
    // Option 1: Vercel cron with CRON_SECRET in query param or header
    const isVercelCron = (cronSecretParam && cronSecret && cronSecretParam === cronSecret) ||
                         (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`);
    
    // Option 2: Service role key authentication (for Supabase cron or manual calls)
    const isServiceKeyAuth = serviceKey && (!authHeader || authHeader === `Bearer ${serviceKey}`);

    if (!isVercelCron && !isServiceKeyAuth) {
      return NextResponse.json(
        { error: 'Unauthorized - Service key or cron secret required' },
        { status: 401 }
      );
    }

    // Get OneSignal credentials from environment
    const onesignalAppId = process.env.ONESIGNAL_APP_ID;
    const onesignalRestApiKey = process.env.ONESIGNAL_REST_API_KEY;
    
    if (!onesignalAppId || !onesignalRestApiKey) {
      console.error('ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create Supabase client with service role key (always from env, not from auth header)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }
    
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get batch size from query params or use default
    const batchSize = parseInt(searchParams.get('batchSize') || '50', 10);

    console.log(`📬 Processing notification queue (batch size: ${batchSize})`);

    // Fetch unprocessed notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('*')
      .is('push_sent_at', null)
      .eq('is_read', false)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch notifications', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No notifications to process',
        processed: 0,
        failed: 0
      });
    }

    console.log(`📋 Found ${notifications.length} notifications to process`);

    // Group notifications by user to batch preference checks
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
      errors: [] as Array<{ notificationId: string; error: string }>
    };

    // Process each user's notifications
    for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
      try {
        // Check user preferences, create defaults if they don't exist
        let { data: prefs, error: prefsError } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();

        // If preferences don't exist, create default ones with everything enabled
        if (prefsError && prefsError.code === 'PGRST116') {
          console.log(`📝 Creating default notification preferences for user ${userId}`);
          
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
            muted_competitions: []
          };

          const { data: newPrefs, error: createError } = await supabase
            .from('notification_preferences')
            .insert(defaultPrefs)
            .select()
            .single();

          if (createError) {
            console.error(`❌ Error creating default preferences for user ${userId}:`, createError);
            results.failed += userNotifications.length;
            continue;
          }

          prefs = newPrefs;
        } else if (prefsError) {
          console.error(`❌ Error fetching preferences for user ${userId}:`, prefsError);
          results.failed += userNotifications.length;
          continue;
        }

        // Check if push notifications are enabled
        if (!prefs.enabled || !prefs.push_enabled) {
          const reason = !prefs.enabled 
            ? 'notifications globally disabled'
            : !prefs.push_enabled 
              ? 'push notifications disabled'
              : 'unknown';
          console.log(`⏭️  Push notifications disabled for user ${userId} (${reason}), skipping ${userNotifications.length} notifications`);
          results.skipped += userNotifications.length;
          
          // Mark as processed (but not sent)
          await supabase
            .from('notifications')
            .update({ push_sent_at: new Date().toISOString() })
            .in('id', userNotifications.map(n => n.id));
          
          continue;
        }

        // Filter notifications by type preferences
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
          console.log(`⏭️  All notifications filtered by preferences for user ${userId}`);
          results.skipped += userNotifications.length;
          
          // Mark as processed
          await supabase
            .from('notifications')
            .update({ push_sent_at: new Date().toISOString() })
            .in('id', userNotifications.map(n => n.id));
          
          continue;
        }

        // Send notifications via OneSignal
        for (const notification of notificationsToSend) {
          try {
            // Build OneSignal payload
            // OneSignal uses external_user_ids to target users (we set this via SDK on mobile)
            // Explicitly set channel to push only to prevent email sending
            const onesignalPayload = {
              app_id: onesignalAppId,
              include_external_user_ids: [userId],
              channel_for_external_user_ids: 'push', // Only send push, not email
              headings: { en: notification.title },
              contents: { en: notification.message },
              data: {
                notificationId: notification.id,
                type: notification.type,
                actionUrl: notification.action_url || null,
                ...(notification.data || {}),
              },
            };

            console.log(`📤 Sending notification ${notification.id} to user ${userId} via OneSignal`);

            // Send to OneSignal
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${onesignalRestApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(onesignalPayload),
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ OneSignal API error for notification ${notification.id}:`, errorText);
              results.failed++;
              results.errors.push({
                notificationId: notification.id,
                error: errorText
              });
            } else {
              const responseData = await response.json();
              console.log(`✅ Notification ${notification.id} sent successfully via OneSignal`);
              results.sent++;

              // Mark as sent
              await supabase
                .from('notifications')
                .update({ push_sent_at: new Date().toISOString() })
                .eq('id', notification.id);
            }

            results.processed++;
            
            // Small delay to respect OneSignal rate limits (~10 notifications/second)
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.error(`❌ Error sending notification ${notification.id}:`, error);
            results.failed++;
            results.errors.push({
              notificationId: notification.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Mark skipped notifications as processed
        const skippedIds = userNotifications
          .filter(n => !notificationsToSend.some(sent => sent.id === n.id))
          .map(n => n.id);
        
        if (skippedIds.length > 0) {
          await supabase
            .from('notifications')
            .update({ push_sent_at: new Date().toISOString() })
            .in('id', skippedIds);
          
          results.skipped += skippedIds.length;
        }

      } catch (error) {
        console.error(`❌ Error processing notifications for user ${userId}:`, error);
        results.failed += userNotifications.length;
      }
    }

    console.log(`✅ Queue processing complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} notifications: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`,
      processed: results.processed,
      sent: results.sent,
      skipped: results.skipped,
      failed: results.failed,
      total: notifications.length,
      errors: results.errors.length > 0 ? results.errors : undefined
    });

  } catch (error) {
    console.error('❌ Error processing notification queue:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check queue status
 * Also supports Vercel Cron (which uses GET requests)
 */
export async function GET(request: NextRequest) {
  try {
    // GET endpoint supports both status check and Vercel cron triggering
    // Get service role key from header or environment
    // Supports both Vercel Cron (CRON_SECRET via query param or header) and Supabase Cron (service role key)
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const cronSecretParam = searchParams.get('cron_secret');
    const cronSecret = process.env.CRON_SECRET;
    const serviceKey = authHeader?.replace('Bearer ', '') || process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Validate authentication
    // Option 1: Vercel cron with CRON_SECRET in query param or header - trigger processing
    const isVercelCron = (cronSecretParam && cronSecret && cronSecretParam === cronSecret) ||
                         (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`);
    
    // Option 2: Service role key authentication (for status check)
    const isServiceKeyAuth = serviceKey && (!authHeader || authHeader === `Bearer ${serviceKey}`);

    if (isVercelCron) {
      // Vercel cron authentication - valid, trigger processing via POST handler
      const postResponse = await POST(request);
      return postResponse;
    } else if (!isServiceKeyAuth) {
      return NextResponse.json(
        { error: 'Unauthorized - Service key or cron secret required' },
        { status: 401 }
      );
    }
    
    // If authenticated with service key, return status only

    // If authenticated with service key, return status only
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Count unprocessed notifications
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('push_sent_at', null)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch queue status', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pending: count || 0
    });

  } catch (error) {
    console.error('❌ Error checking queue status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

