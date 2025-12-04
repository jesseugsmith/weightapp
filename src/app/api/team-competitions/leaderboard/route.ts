/**
 * Team V2 Leaderboard API
 * Handles leaderboard queries and score recalculation for team_v2 competitions
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { calculateCompetition } from '@/lib/competition-calculations';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================================================
// GET - Get leaderboard for a team_v2 competition
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get('competitionId');

    if (!competitionId) {
      return NextResponse.json(
        { error: 'competitionId is required' },
        { status: 400 }
      );
    }

    // Verify competition is team_v2 mode
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .select('id, name, activity_type, competition_mode')
      .eq('id', competitionId)
      .single();

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Competition not found' },
        { status: 404 }
      );
    }

    if (competition.competition_mode !== 'team_v2') {
      return NextResponse.json(
        { error: 'This endpoint is for team_v2 competitions only' },
        { status: 400 }
      );
    }

    // Get teams with members, ordered by rank
    const { data: teams, error: teamsError } = await supabase
      .from('competition_teams')
      .select(`
        id,
        name,
        team_code,
        avatar,
        captain_user_id,
        total_score,
        rank,
        member_count,
        is_active,
        created_at,
        updated_at,
        captain:profiles!competition_teams_captain_user_id_fkey(
          id, first_name, last_name, nickname, avatar, photo_url
        ),
        members:competition_team_members(
          id,
          user_id,
          individual_score,
          starting_value,
          current_value,
          contribution_value,
          joined_at,
          is_active,
          user:profiles(
            id, first_name, last_name, nickname, avatar, photo_url
          )
        )
      `)
      .eq('competition_id', competitionId)
      .eq('is_active', true)
      .order('rank', { ascending: true, nullsFirst: false });

    if (teamsError) {
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard', details: teamsError.message },
        { status: 500 }
      );
    }

    // Format leaderboard response
    const leaderboard = (teams || []).map((team: any, index: number) => ({
      rank: team.rank || index + 1,
      team: {
        id: team.id,
        name: team.name,
        team_code: team.team_code,
        avatar: team.avatar,
        captain: team.captain,
        member_count: team.member_count,
      },
      total_score: team.total_score || 0,
      member_scores: (team.members || [])
        .filter((m: any) => m.is_active)
        .sort((a: any, b: any) => (b.individual_score || 0) - (a.individual_score || 0))
        .map((member: any) => ({
          user_id: member.user_id,
          user: member.user,
          individual_score: member.individual_score || 0,
          starting_value: member.starting_value,
          current_value: member.current_value,
          contribution_value: member.contribution_value || 0,
        })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        competition: {
          id: competition.id,
          name: competition.name,
          activity_type: competition.activity_type,
        },
        teams: leaderboard,
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Leaderboard API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Recalculate scores for a team_v2 competition
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { competition_id } = body;

    if (!competition_id) {
      return NextResponse.json(
        { error: 'competition_id is required' },
        { status: 400 }
      );
    }

    console.log(`[Leaderboard API] Recalculating scores for competition: ${competition_id}`);

    // Use the calculation router which will detect team_v2 mode
    const result = await calculateCompetition(competition_id, supabase);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      updated_count: result.updated_count,
    });
  } catch (error: any) {
    console.error('[Leaderboard API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

