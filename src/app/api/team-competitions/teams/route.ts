/**
 * Team V2 Teams API
 * Handles team CRUD within team_v2 competitions
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================================================
// GET - Get teams for a competition or specific team
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get('competitionId');
    const teamId = searchParams.get('teamId');
    const userId = searchParams.get('userId');

    if (teamId) {
      // Get specific team with members
      const { data: team, error } = await supabase
        .from('competition_teams')
        .select(`
          *,
          captain:profiles!competition_teams_captain_user_id_fkey(*),
          members:competition_team_members(
            *,
            user:profiles(*)
          ),
          competition:competitions(*)
        `)
        .eq('id', teamId)
        .single();

      if (error || !team) {
        return NextResponse.json(
          { error: 'Team not found', details: error?.message },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: team });
    }

    // Get user's team for a competition
    if (userId && competitionId) {
      const { data: membership, error } = await supabase
        .from('competition_team_members')
        .select(`
          *,
          team:competition_teams!inner(
            *,
            captain:profiles!competition_teams_captain_user_id_fkey(*),
            members:competition_team_members(
              *,
              user:profiles(*)
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('team.competition_id', competitionId)
        .single();

      if (error || !membership) {
        return NextResponse.json({ success: true, data: null });
      }

      return NextResponse.json({ success: true, data: (membership as any).team });
    }

    // Get all teams for a competition
    if (competitionId) {
      const { data: teams, error } = await supabase
        .from('competition_teams')
        .select(`
          *,
          captain:profiles!competition_teams_captain_user_id_fkey(*),
          members:competition_team_members(
            *,
            user:profiles(*)
          )
        `)
        .eq('competition_id', competitionId)
        .eq('is_active', true)
        .order('rank', { ascending: true, nullsFirst: false });

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch teams', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: teams });
    }

    return NextResponse.json(
      { error: 'competitionId or teamId is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Teams API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new team or join an existing team
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create':
        return await createTeam(supabase, body);
      case 'join':
        return await joinTeam(supabase, body);
      case 'join_by_code':
        return await joinTeamByCode(supabase, body);
      case 'leave':
        return await leaveTeam(supabase, body);
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, join, join_by_code, leave' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[Teams API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Create Team
// ============================================================================
async function createTeam(supabase: any, body: any) {
  const { competition_id, name, captain_user_id, avatar } = body;

  if (!competition_id || !name || !captain_user_id) {
    return NextResponse.json(
      { error: 'competition_id, name, and captain_user_id are required' },
      { status: 400 }
    );
  }

  // Generate unique team code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let teamCode = '';
  for (let i = 0; i < 6; i++) {
    teamCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Check if competition allows more teams
  const { data: competition } = await supabase
    .from('competitions')
    .select('max_teams')
    .eq('id', competition_id)
    .single();

  const { count: currentTeamCount } = await supabase
    .from('competition_teams')
    .select('*', { count: 'exact', head: true })
    .eq('competition_id', competition_id)
    .eq('is_active', true);

  if (competition?.max_teams && currentTeamCount >= competition.max_teams) {
    return NextResponse.json(
      { error: `Competition has reached maximum of ${competition.max_teams} teams` },
      { status: 400 }
    );
  }

  // Create team
  const { data: team, error: teamError } = await supabase
    .from('competition_teams')
    .insert({
      competition_id,
      name,
      team_code: teamCode,
      captain_user_id,
      avatar: avatar || null,
      is_active: true,
    })
    .select(`
      *,
      captain:profiles!competition_teams_captain_user_id_fkey(*)
    `)
    .single();

  if (teamError) {
    return NextResponse.json(
      { error: 'Failed to create team', details: teamError.message },
      { status: 500 }
    );
  }

  // Add captain as member
  await supabase
    .from('competition_team_members')
    .insert({
      competition_team_id: team.id,
      user_id: captain_user_id,
      is_active: true,
      joined_at: new Date().toISOString(),
    });

  return NextResponse.json({ success: true, data: team });
}

// ============================================================================
// Helper: Join Team by ID
// ============================================================================
async function joinTeam(supabase: any, body: any) {
  const { team_id, user_id } = body;

  if (!team_id || !user_id) {
    return NextResponse.json(
      { error: 'team_id and user_id are required' },
      { status: 400 }
    );
  }

  // Get team and competition info
  const { data: team, error: teamError } = await supabase
    .from('competition_teams')
    .select('*, competition:competitions(*)')
    .eq('id', team_id)
    .eq('is_active', true)
    .single();

  if (teamError || !team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Check team capacity
  const maxUsers = team.competition?.max_users_per_team || 10;
  if (team.member_count >= maxUsers) {
    return NextResponse.json(
      { error: 'Team is full' },
      { status: 400 }
    );
  }

  // Check if user is already in a team for this competition
  const { data: existingMembership } = await supabase
    .from('competition_team_members')
    .select(`
      *,
      team:competition_teams!inner(competition_id)
    `)
    .eq('user_id', user_id)
    .eq('is_active', true);

  const inSameCompetition = existingMembership?.some(
    (m: any) => m.team?.competition_id === team.competition_id
  );

  if (inSameCompetition) {
    return NextResponse.json(
      { error: 'You are already in a team for this competition' },
      { status: 400 }
    );
  }

  // Add user to team
  const { data: member, error: memberError } = await supabase
    .from('competition_team_members')
    .insert({
      competition_team_id: team_id,
      user_id,
      is_active: true,
      joined_at: new Date().toISOString(),
    })
    .select(`
      *,
      user:profiles(*),
      team:competition_teams(*)
    `)
    .single();

  if (memberError) {
    return NextResponse.json(
      { error: 'Failed to join team', details: memberError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: member });
}

// ============================================================================
// Helper: Join Team by Code
// ============================================================================
async function joinTeamByCode(supabase: any, body: any) {
  const { competition_id, team_code, user_id } = body;

  if (!competition_id || !team_code || !user_id) {
    return NextResponse.json(
      { error: 'competition_id, team_code, and user_id are required' },
      { status: 400 }
    );
  }

  // Find team by code
  const { data: team, error: teamError } = await supabase
    .from('competition_teams')
    .select('*')
    .eq('competition_id', competition_id)
    .eq('team_code', team_code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (teamError || !team) {
    return NextResponse.json(
      { error: 'Invalid team code' },
      { status: 404 }
    );
  }

  // Use joinTeam helper
  return joinTeam(supabase, { team_id: team.id, user_id });
}

// ============================================================================
// Helper: Leave Team
// ============================================================================
async function leaveTeam(supabase: any, body: any) {
  const { team_id, user_id } = body;

  if (!team_id || !user_id) {
    return NextResponse.json(
      { error: 'team_id and user_id are required' },
      { status: 400 }
    );
  }

  // Check if user is captain
  const { data: team } = await supabase
    .from('competition_teams')
    .select('captain_user_id')
    .eq('id', team_id)
    .single();

  if (team?.captain_user_id === user_id) {
    return NextResponse.json(
      { error: 'Captain cannot leave the team. Transfer captaincy first or delete the team.' },
      { status: 400 }
    );
  }

  // Set member as inactive
  const { error } = await supabase
    .from('competition_team_members')
    .update({ is_active: false })
    .eq('competition_team_id', team_id)
    .eq('user_id', user_id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to leave team', details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

