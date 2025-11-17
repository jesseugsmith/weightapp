import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';

/**
 * API endpoint to send daily competition reminder notifications
 * This should be called by a scheduled job (cron/vercel cron)
 */
export async function POST(request: NextRequest) {
  try {
    // Get Novu API key from environment
    const novuApiKey = process.env.NOVU_API_KEY;
    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get system admin access to Supabase
    const authResult = await getAuthenticatedSupabase(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { supabase } = authResult;

    // Get all active competitions and their participants
    const { data: activeCompetitions, error: competitionsError } = await supabase
      .from('competitions')
      .select(`
        id,
        name,
        end_date,
        competition_participants!inner(
          user_id,
          is_active,
          profiles(
            first_name,
            last_name,
            id
          )
        )
      `)
      .gte('end_date', new Date().toISOString())
      .eq('competition_participants.is_active', true);

    if (competitionsError || !activeCompetitions) {
      console.error('Failed to fetch active competitions:', competitionsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitions' },
        { status: 500 }
      );
    }

    console.log(`📊 Found ${activeCompetitions.length} active competitions`);

    const notificationPromises = [];

    // Send notifications to all participants in active competitions
    for (const competition of activeCompetitions) {
      const daysRemaining = Math.ceil(
        (new Date(competition.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const participant of competition.competition_participants) {
        if (participant.profiles) {
          const userName = [participant.profiles.first_name, participant.profiles.last_name]
            .filter(Boolean)
            .join(' ') || 'there';

          // Create notification payload
          const notificationPromise = fetch('https://api.novu.co/v1/events/trigger', {
            method: 'POST',
            headers: {
              'Authorization': `ApiKey ${novuApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'daily-competition-reminder',
              to: {
                subscriberId: participant.user_id,
              },
              payload: {
                userName,
                competitionName: competition.name,
                competitionId: competition.id,
                daysRemaining,
                actionUrl: `/competition/${competition.id}`,
                today: new Date().toLocaleDateString(),
                timestamp: new Date().toISOString()
              }
            })
          });

          notificationPromises.push(notificationPromise);
        }
      }
    }

    // Execute all notifications in parallel
    const results = await Promise.allSettled(notificationPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Daily reminders sent: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: 'Daily competition reminders sent',
      stats: {
        competitionsProcessed: activeCompetitions.length,
        notificationsSent: successful,
        notificationsFailed: failed
      }
    });

  } catch (error) {
    console.error('❌ Error sending daily competition reminders:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}