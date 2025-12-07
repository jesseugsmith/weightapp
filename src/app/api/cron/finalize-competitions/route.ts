import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Cron Job to finalize expired competitions
 * Runs hourly (or at a scheduled time)
 * 
 * This endpoint:
 * 1. Finds all competitions that have passed their end_date but are still 'started'
 * 2. Updates their status to 'completed'
 * 3. Sends completion notifications to participants
 */
export async function GET(request: NextRequest) {
  console.log('\n🏁 Cron: Finalize Expired Competitions - Triggered');

  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('❌ Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call the database function to auto-complete expired competitions
    const { data: completedCompetitions, error: rpcError } = await supabaseAdmin
      .rpc('auto_complete_expired_competitions');

    if (rpcError) {
      console.error('❌ Error calling auto_complete_expired_competitions:', rpcError);
      return NextResponse.json(
        { error: 'Failed to finalize competitions', details: rpcError.message },
        { status: 500 }
      );
    }

    if (!completedCompetitions || completedCompetitions.length === 0) {
      console.log('ℹ️ No competitions to finalize');
      return NextResponse.json({
        success: true,
        message: 'No competitions to finalize',
        finalized: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📋 Finalized ${completedCompetitions.length} competition(s)`);

    // Send completion notifications for each finalized competition
    const notificationResults = {
      sent: 0,
      failed: 0,
    };

    for (const comp of completedCompetitions) {
      try {
        console.log(`\n🏆 Processing completion for: ${comp.competition_name} (${comp.competition_id})`);

        // Get all active participants
        const { data: participants, error: participantError } = await supabaseAdmin
          .from('competition_participants')
          .select('id, user_id, is_active')
          .eq('competition_id', comp.competition_id)
          .eq('is_active', true);

        if (participantError) {
          console.error(`❌ Failed to fetch participants for competition ${comp.competition_id}:`, participantError);
          notificationResults.failed++;
          continue;
        }

        if (!participants || participants.length === 0) {
          console.log(`ℹ️ No participants found for competition ${comp.competition_id}`);
          continue;
        }

        // Get final leaderboard/rankings from calculation_results
        const { data: rankings, error: rankingsError } = await supabaseAdmin
          .from('calculation_results')
          .select('subject_id, rank, calculated_score, calculation_data')
          .eq('competition_id', comp.competition_id)
          .eq('subject_type', 'participant')
          .order('rank', { ascending: true, nullsFirst: false });

        // Build a map of participant rankings
        const rankingMap = new Map<string, { rank: number | null; score: number }>();
        if (rankings) {
          rankings.forEach((r) => {
            rankingMap.set(r.subject_id, { rank: r.rank, score: r.calculated_score });
          });
        }

        // Find the winner (rank 1)
        const winner = rankings?.find((r) => r.rank === 1);
        let winnerUserId: string | null = null;
        if (winner) {
          const winnerParticipant = participants.find((p) => p.id === winner.subject_id);
          winnerUserId = winnerParticipant?.user_id || null;
        }

        // Create notifications for all participants
        const notifications = participants.map((participant) => {
          const ranking = rankingMap.get(participant.id);
          const isWinner = participant.user_id === winnerUserId;

          let title: string;
          let message: string;

          if (isWinner) {
            title = '🏆 Congratulations! You Won!';
            message = `You finished in 1st place in ${comp.competition_name}! Great job!`;
          } else if (ranking?.rank) {
            title = '🏁 Competition Completed!';
            message = `${comp.competition_name} has ended. You finished in position #${ranking.rank}.`;
          } else {
            title = '🏁 Competition Completed!';
            message = `${comp.competition_name} has ended. Check your final results!`;
          }

          return {
            user_id: participant.user_id,
            title,
            message,
            type: 'competition_completed',
            action_url: `/competition/${comp.competition_id}`,
            is_read: false,
            data: {
              competition_id: comp.competition_id,
              competition_name: comp.competition_name,
              rank: ranking?.rank || null,
              score: ranking?.score || 0,
              is_winner: isWinner,
            },
          };
        });

        const { error: notifError } = await supabaseAdmin
          .from('notifications')
          .insert(notifications);

        if (notifError) {
          console.warn(`⚠️ Failed to create completion notifications for competition ${comp.competition_id}:`, notifError);
          notificationResults.failed++;
        } else {
          console.log(`🔔 Created ${notifications.length} completion notifications`);
          notificationResults.sent += notifications.length;
        }

      } catch (error) {
        console.error(`❌ Error processing completion for competition ${comp.competition_id}:`, error);
        notificationResults.failed++;
      }
    }

    // Trigger OneSignal queue processor to send push notifications
    try {
      const onesignalResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/onesignal/process-queue`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
        }
      );

      if (onesignalResponse.ok) {
        console.log('📤 OneSignal queue processor triggered successfully');
      } else {
        console.warn('⚠️ Failed to trigger OneSignal queue processor:', await onesignalResponse.text());
      }
    } catch (error) {
      console.warn('⚠️ Error triggering OneSignal queue processor:', error);
    }

    console.log(`\n✅ Cron job complete: ${completedCompetitions.length} finalized, ${notificationResults.sent} notifications sent`);

    return NextResponse.json({
      success: true,
      message: `Finalized ${completedCompetitions.length} competition(s)`,
      finalized: completedCompetitions.length,
      competitions: completedCompetitions.map((c: { competition_id: string; competition_name: string; completed_at: string }) => ({
        id: c.competition_id,
        name: c.competition_name,
        completedAt: c.completed_at,
      })),
      notifications: notificationResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error in finalize-competitions cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

