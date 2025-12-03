import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/competitions/[competitionId]/recalculate
 * Recalculate leaderboard for a competition
 * 
 * Supports:
 * - API token authentication (Bearer token)
 * - Supabase session token (Bearer token with Supabase access_token)
 * - Session cookie (for web app)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { competitionId: string } }
) {
  console.log('\n🚀 POST /api/competitions/recalculate - Request received');
  
  try {
    const competitionId = params.competitionId;
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Try API token auth first, then Supabase session token, then session cookie
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
              // No-op for API token requests
            },
          },
        }
      );

      const { data: tokens, error: tokenError } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!tokenError && tokens) {
        // Check expiration
        if (tokens.expires_at && new Date(tokens.expires_at) < new Date()) {
          return NextResponse.json(
            { error: 'API token has expired' },
            { status: 401 }
          );
        }

        userId = tokens.user_id;
      } else {
        // Try Supabase session token (for mobile app)
        const supabaseWithToken = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
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
      // Session authentication (for web app)
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

    // Get competition details
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

    console.log(`📊 Recalculating competition: ${competition.name} (${competition.competition_mode})`);

    // Use shared calculation function
    const result = await calculateCompetition(competitionId, supabaseAdmin);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Recalculation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      updated_count: result.updated_count,
      total_progress: result.total_progress,
    });
  } catch (error: any) {
    console.error('❌ Error recalculating competition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to recalculate competition' },
      { status: 500 }
    );
  }
}

import { calculateCompetition } from '@/lib/competition-calculations';

