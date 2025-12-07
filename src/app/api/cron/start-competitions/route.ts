import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Cron Job to start pending competitions
 * Runs daily at 12:00 AM (midnight)
 * 
 * This endpoint:
 * 1. Finds all competitions with status='pending'
 * 2. Sets start_date to NOW(), calculates end_date from duration_days
 * 3. Updates status to 'started'
 * 4. Initializes participant starting values (weight: latest weight, steps: 0)
 * 5. Seeds calculation_results table
 * 6. Creates notifications for participants (both in-app and push)
 */
export async function GET(request: NextRequest) {
  console.log('\n🌅 Cron: Start Pending Competitions - Triggered');

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

    // Find all pending competitions
    const { data: pendingCompetitions, error: fetchError } = await supabaseAdmin
      .from('competitions')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('❌ Error fetching pending competitions:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch pending competitions', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingCompetitions || pendingCompetitions.length === 0) {
      console.log('ℹ️ No pending competitions to start');
      return NextResponse.json({
        success: true,
        message: 'No pending competitions to start',
        started: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📋 Found ${pendingCompetitions.length} pending competition(s) to start`);

    const results = {
      started: 0,
      failed: 0,
      errors: [] as Array<{ competitionId: string; error: string }>,
    };

    // Process each pending competition
    for (const competition of pendingCompetitions) {
      try {
        console.log(`\n🏁 Starting competition: ${competition.name} (${competition.id})`);

        // Calculate start and end dates (start now at midnight)
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(startDate.getTime() + competition.duration_days * 24 * 60 * 60 * 1000);

        // Get active participants
        const { data: participants, error: participantError } = await supabaseAdmin
          .from('competition_participants')
          .select('id, user_id, is_active')
          .eq('competition_id', competition.id)
          .eq('is_active', true);

        if (participantError) {
          console.error(`❌ Failed to fetch participants for competition ${competition.id}:`, participantError);
          results.failed++;
          results.errors.push({ competitionId: competition.id, error: participantError.message });
          continue;
        }

        console.log(`👥 Found ${participants?.length || 0} active participants`);

        // Initialize calculation_results based on activity type
        if (participants && participants.length > 0) {
          const nowIso = new Date().toISOString();
          
          // Fetch starting values based on activity type
          const calculationRows = await Promise.all(
            participants.map(async (participant) => {
              let startingValue: number | null = null;

              if (competition.activity_type === 'weight') {
                // For weight competitions: use latest weight entry
                const { data: weightEntry } = await supabaseAdmin
                  .from('activity_entries')
                  .select('value')
                  .eq('user_id', participant.user_id)
                  .eq('activity_type', 'weight')
                  .is('deleted_at', null)
                  .order('date', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                startingValue = weightEntry?.value ?? null;
                console.log(`  ⚖️ Participant ${participant.user_id}: starting weight = ${startingValue ?? 'not set'}`);
              } else {
                // For steps, distance, calories, etc: start at 0
                startingValue = 0;
                console.log(`  👟 Participant ${participant.user_id}: starting ${competition.activity_type} = 0`);
              }

              return {
                competition_id: competition.id,
                subject_type: 'participant',
                subject_id: participant.id,
                calculation_method: competition.scoring_method || 'total_value',
                calculated_score: 0,
                rank: null,
                percentile: null,
                activity_entries_count: 0,
                days_active: 0,
                calculation_data: {
                  starting_value: startingValue,
                  current_value: startingValue,
                  total_contribution: 0,
                  value_change: 0,
                  value_change_percentage: 0,
                  entry_count: 0,
                  baseline: true,
                  seeded_at: nowIso,
                },
                score_breakdown: null,
                calculation_version: 'initial',
                calculated_at: nowIso,
                created_at: nowIso,
                updated_at: nowIso,
              };
            })
          );

          // Upsert calculation_results
          const { error: calcSeedError } = await supabaseAdmin
            .from('calculation_results')
            .upsert(calculationRows, {
              onConflict: 'competition_id,subject_id,subject_type',
            });

          if (calcSeedError) {
            console.error(`❌ Failed to seed calculation_results for competition ${competition.id}:`, calcSeedError);
            results.failed++;
            results.errors.push({ competitionId: competition.id, error: calcSeedError.message });
            continue;
          }

          console.log(`📈 Seeded calculation_results for ${calculationRows.length} participants`);

          // Create in-app notifications for all participants
          const notifications = participants.map((participant) => ({
            user_id: participant.user_id,
            title: '🏁 Competition Started!',
            message: `${competition.name} has begun! Good luck!`,
            type: 'competition_start',
            action_url: `/competition/${competition.id}`,
            is_read: false,
            data: {
              competition_id: competition.id,
              competition_name: competition.name,
              duration_days: competition.duration_days,
              activity_type: competition.activity_type,
            },
          }));

          const { error: notifError } = await supabaseAdmin
            .from('notifications')
            .insert(notifications);

          if (notifError) {
            console.warn(`⚠️ Failed to create notifications for competition ${competition.id}:`, notifError);
            // Don't fail the competition start, just log the warning
          } else {
            console.log(`🔔 Created ${notifications.length} notifications for participants`);
          }
        }

        // Update competition status to started
        const { error: updateError } = await supabaseAdmin
          .from('competitions')
          .update({
            status: 'started',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            actual_start_date: startDate.toISOString(),
            actual_end_date: endDate.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', competition.id);

        if (updateError) {
          console.error(`❌ Failed to update competition ${competition.id} status:`, updateError);
          results.failed++;
          results.errors.push({ competitionId: competition.id, error: updateError.message });
          continue;
        }

        console.log(`✅ Competition ${competition.name} started successfully`);
        results.started++;

      } catch (error) {
        console.error(`❌ Error starting competition ${competition.id}:`, error);
        results.failed++;
        results.errors.push({
          competitionId: competition.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
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

    console.log(`\n✅ Cron job complete: ${results.started} started, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Started ${results.started} competition(s)`,
      started: results.started,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error in start-competitions cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

