import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/competitions/[competitionId]/start
 * Start a competition (sets start/end dates and status)
 *
 * Auth:
 * - Bearer API token (api_tokens table)
 * - Bearer Supabase session token (mobile)
 * - Session cookie (web)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  console.log('\n🚀 POST /api/competitions/[competitionId]/start - Request received');

  const competitionId = params.competitionId;
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Extract dev_start_today flag from query or body
    let devStartToday = req.nextUrl.searchParams.get('dev_start_today') === 'true';
    try {
      const body = await req.json();
      if (typeof body?.dev_start_today === 'boolean') {
        devStartToday = body.dev_start_today;
      }
    } catch {
      // No JSON body; ignore
    }
    console.log('➡️ Start request', { competitionId, devStartToday, queryFlag: req.nextUrl.searchParams.get('dev_start_today') });

    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // First try API token authentication
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll() {
              // No-op for token requests
            },
          },
        }
      );

      const { data: apiToken, error: tokenError } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!tokenError && apiToken) {
        if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
          return NextResponse.json(
            { error: 'API token has expired' },
            { status: 401 }
          );
        }
        userId = apiToken.user_id;
      } else {
        // Try Supabase session token (mobile/web bearer)
        const supabaseWithToken = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          }
        );

        const { data: { user }, error: userError } = await supabaseWithToken.auth.getUser();
        if (!userError && user) {
          userId = user.id;
        } else {
          return NextResponse.json(
            { error: 'Invalid authentication token' },
            { status: 401 }
          );
        }
      }
    } else {
      // Session authentication (web)
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore
              }
            },
          },
        }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized - Please sign in' },
          { status: 401 }
        );
      }
      userId = user.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('✅ Authenticated user', { userId, hasAuthHeader: !!authHeader });

    // Fetch competition
    const { data: competition, error: compError } = await supabaseAdmin
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single();

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    // Permission checks
    if (competition.created_by !== userId) {
      return NextResponse.json(
        { error: 'Only the competition creator can start the competition' },
        { status: 403 }
      );
    }

    if (competition.status !== 'draft') {
      return NextResponse.json(
        { error: 'Competition can only be started from draft status' },
        { status: 400 }
      );
    }

    if (!competition.duration_days || competition.duration_days <= 0) {
      return NextResponse.json(
        { error: 'Competition must have a valid duration_days value' },
        { status: 400 }
      );
    }

    // Seed weight participants with their latest weight before starting
    let weightParticipants: {
      participantId: string;
      userId: string;
      latestWeight: number | null;
    }[] = [];

    if (competition.activity_type === 'weight') {
      console.log('⚖️ Weight competition detected, gathering participant weights for seeding');
      const { data: participants, error: participantError } = await supabaseAdmin
        .from('competition_participants')
        .select('id, user_id, is_active')
        .eq('competition_id', competitionId)
        .eq('is_active', true);

      if (participantError) {
        console.error('❌ Failed to fetch participants for seeding weights', participantError);
        return NextResponse.json(
          { error: 'Failed to fetch participants for seeding weights' },
          { status: 500 }
        );
      }

      if (participants?.length) {
        console.log(`👥 Found ${participants.length} active participants, fetching latest weights`);
        const seeded = await Promise.all(
          participants.map(async (participant) => {
            const { data: weightEntry, error: weightError } = await supabaseAdmin
              .from('activity_entries')
              .select('value, unit, date')
              .eq('user_id', participant.user_id)
              .eq('activity_type', 'weight')
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (weightError) {
              console.warn('⚠️ Failed to fetch latest weight for participant', {
                participantId: participant.id,
                userId: participant.user_id,
                error: weightError,
              });
            }

            const latestWeight = weightEntry?.value ?? null;
            return {
              participantId: participant.id,
              userId: participant.user_id,
              latestWeight,
            };
          })
        );

        weightParticipants = seeded;
      } else {
        console.log('ℹ️ No active participants to seed weights');
      }
    }

    // Calculate start/end dates (midnight)
    const startDate = new Date();
    if (!devStartToday) {
      startDate.setDate(startDate.getDate() + 1);
    }
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + competition.duration_days * 24 * 60 * 60 * 1000);

    const fullPayload = {
      status: 'started',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      actual_start_date: startDate.toISOString(),
      actual_end_date: endDate.toISOString(),
      updated_at: new Date().toISOString(),
    };
    console.log('🕒 Setting start/end dates', { startDate, endDate, devStartToday });

    
    // Seed calculation_results for weight competitions
    if (competition.activity_type === 'weight' && weightParticipants.length > 0) {
      const nowIso = new Date().toISOString();
      const rows = weightParticipants.map((participant) => ({
        competition_id: competitionId,
        subject_type: 'participant',
        subject_id: participant.participantId,
        calculation_method: competition.scoring_method || 'total_value',
        calculated_score: 0,
        rank: null, // allow dense_rank to compute based on calculated_score
        percentile: null,
        activity_entries_count: 0,
        days_active: 0,
        calculation_data: {
          starting_value: participant.latestWeight,
          current_value: participant.latestWeight,
          total_contribution: 0,
          value_change: 0,
          value_change_percentage: 0,
          entry_count: 0,
          baseline: true,
          seeded_at: nowIso,
          dev_start_today: devStartToday,
        },
        score_breakdown: null,
        calculation_version: 'initial',
        calculated_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const { error: calcSeedError } = await supabaseAdmin
        .from('calculation_results')
        .upsert(rows, {
          // Merge updates so existing seeds get refreshed with latest values
          onConflict: 'competition_id,subject_id,subject_type',
        });

      if (calcSeedError) {
        console.error('❌ Failed to seed calculation_results', calcSeedError);
        return NextResponse.json(
          { error: 'Failed to seed calculation results' },
          { status: 500 }
        );
      }
      console.log('📈 Seeded calculation_results for participants', { count: rows.length });
    }

    // Attempt full update, retry with minimal if columns missing
    let { data: updatedCompetition, error: updateError } = await supabaseAdmin
      .from('competitions')
      .update(fullPayload)
      .eq('id', competitionId)
      .select()
      .single();

    if (updateError && (updateError.code === 'PGRST204' || /column.+does not exist/i.test(updateError.message))) {
      console.warn('⚠️ Columns missing on competitions, retrying with minimal payload', { message: updateError.message });
      const minimalPayload = {
        status: 'started',
        updated_at: new Date().toISOString(),
      };

      const retry = await supabaseAdmin
        .from('competitions')
        .update(minimalPayload)
        .eq('id', competitionId)
        .select()
        .single();

      updatedCompetition = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      console.error('❌ Failed to update competition start', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to start competition' },
        { status: 500 }
      );
    }

    console.log('✅ Competition started', { competitionId, devStartToday, startDate, endDate });
    return NextResponse.json({
      success: true,
      message: `Competition started successfully! Duration: ${competition.duration_days} days`,
      competition: updatedCompetition,
    });
  } catch (error: any) {
    console.error('❌ Error starting competition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start competition' },
      { status: 500 }
    );
  }
}

