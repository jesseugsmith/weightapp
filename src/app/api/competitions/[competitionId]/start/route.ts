import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/competitions/[competitionId]/start
 * Schedule a competition to start (sets status to 'pending')
 * The competition will actually start at the next midnight cron job run.
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

    // Set status to 'pending' - the cron job will handle:
    // - Setting start/end dates
    // - Seeding calculation_results with participant starting values
    // - Sending notifications
    const { data: updatedCompetition, error: updateError } = await supabaseAdmin
      .from('competitions')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', competitionId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update competition status to pending', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to schedule competition start' },
        { status: 500 }
      );
    }

    console.log('✅ Competition scheduled to start', { competitionId, status: 'pending' });
    return NextResponse.json({
      success: true,
      message: `Competition scheduled! It will start at midnight tonight.`,
      competition: updatedCompetition,
    });
  } catch (error: any) {
    console.error('❌ Error scheduling competition start:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule competition start' },
      { status: 500 }
    );
  }
}
