import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cron/automation endpoint to start all scheduled competitions.
 * Auth: Bearer <anon key> (to allow lightweight callers like cron).
 * Logic mirrors the former DB stored procedure so we can log/trace in app.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${anonKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date().toISOString();

    // Find competitions that are scheduled to start and whose start_date has arrived
    const { data: competitions, error: compsError } = await supabase
      .from('competitions')
      .select('*')
      .eq('status', 'started')
      .not('start_date', 'is', null)
      .lte('start_date', now)
      .limit(100);

    if (compsError) {
      console.error('❌ Failed to fetch competitions to activate:', compsError);
      return NextResponse.json(
        { error: 'Failed to fetch competitions', details: compsError.message },
        { status: 500 }
      );
    }

    let competitionsActivated = 0;
    let notificationsSent = 0;

    for (const competition of competitions || []) {
      // Skip if notifications were already sent for this competition
      const { count: existingNotifs, error: notifCheckError } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'competition-started')
        .filter('data->>competitionId', 'eq', competition.id)
        .gte('created_at', competition.start_date);

      if (notifCheckError) {
        console.error(
          `❌ Failed to check existing notifications for competition ${competition.id}:`,
          notifCheckError
        );
        continue;
      }

      if ((existingNotifs ?? 0) > 0) {
        continue;
      }

      competitionsActivated += 1;

      // Fetch active participants with optional first_name for logging
      const { data: participants, error: participantsError } = await supabase
        .from('competition_participants')
        .select('id, user_id, profiles!inner(first_name)')
        .eq('competition_id', competition.id)
        .eq('is_active', true);

      if (participantsError) {
        console.error(
          `❌ Failed to fetch participants for competition ${competition.id}:`,
          participantsError
        );
        continue;
      }

      // Seed calculation_results for weight competitions (mirror manual start logic)
      if (competition.activity_type === 'weight' && (participants?.length || 0) > 0) {
        const nowIso = new Date().toISOString();

        const seeded = await Promise.all(
          (participants || []).map(async (participant) => {
            const { data: weightEntry, error: weightError } = await supabase
              .from('activity_entries')
              .select('value, unit, date')
              .eq('user_id', participant.user_id)
              .eq('activity_type', 'weight')
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (weightError) {
              console.warn('⚠️ Failed to fetch latest weight for participant (cron)', {
                participantId: participant.id,
                userId: participant.user_id,
                error: weightError,
              });
            }

            const latestWeight = weightEntry?.value ?? null;

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
                starting_value: latestWeight,
                current_value: latestWeight,
                total_contribution: 0,
                value_change: 0,
                value_change_percentage: 0,
                entry_count: 0,
                baseline: true,
                seeded_at: nowIso,
                dev_start_today: false,
              },
              score_breakdown: null,
              calculation_version: 'initial',
              calculated_at: nowIso,
              created_at: nowIso,
              updated_at: nowIso,
            };
          })
        );

        const { error: calcSeedError } = await supabase
          .from('calculation_results')
          .upsert(seeded, {
            onConflict: 'competition_id,subject_id,subject_type',
          });

        if (calcSeedError) {
          console.error(
            `❌ Failed to seed calculation_results for competition ${competition.id} (cron)`,
            calcSeedError
          );
        } else {
          console.log(
            `📈 Seeded calculation_results (cron) for competition ${competition.id}`,
            { count: seeded.length }
          );
        }
      }

      for (const participant of participants || []) {
        const userId = participant.user_id;

        // Avoid duplicate per-user notification
        const { count: existingUserNotifs, error: existingUserNotifsError } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'competition-started')
          .filter('data->>competitionId', 'eq', competition.id)
          .gte('created_at', competition.start_date);

        if (existingUserNotifsError) {
          console.error(
            `❌ Failed to check existing user notification for competition ${competition.id}, user ${userId}:`,
            existingUserNotifsError
          );
          continue;
        }

        if ((existingUserNotifs ?? 0) > 0) {
          continue;
        }

        const { error: insertError } = await supabase.from('notifications').insert({
          user_id: userId,
          title: '🏁 Competition Started!',
          message: `${competition.name} has started! Good luck!`,
          type: 'competition-started',
          is_read: false,
          action_url: `/competition/${competition.id}`,
          data: {
            competitionId: competition.id,
            competitionName: competition.name,
          },
          created_at: now,
        });

        if (insertError) {
          console.error(
            `❌ Failed to insert notification for competition ${competition.id}, user ${userId}:`,
            insertError
          );
          continue;
        }

        notificationsSent += 1;
      }

      console.log(
        `✅ Activated competition ${competition.name} (${competition.id}) - notifications sent: ${notificationsSent}`
      );
    }

    return NextResponse.json({
      success: true,
      competitions_activated: competitionsActivated,
      notifications_sent: notificationsSent,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Unexpected error starting competitions:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

