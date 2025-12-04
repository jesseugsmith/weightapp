/**
 * Team V2 Competitions API
 * Handles team competition CRUD and operations
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================================================
// GET - List team_v2 competitions or get specific competition
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get('competitionId');
    const userId = searchParams.get('userId');

    if (competitionId) {
      // Get specific team competition with teams and members
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .select(`
          *,
          creator:profiles!competitions_new_created_by_fkey(*)
        `)
        .eq('id', competitionId)
        .eq('competition_mode', 'team_v2')
        .single();

      if (compError || !competition) {
        return NextResponse.json(
          { error: 'Competition not found', details: compError?.message },
          { status: 404 }
        );
      }

      // Get teams with members
      const { data: teams, error: teamsError } = await supabase
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

      return NextResponse.json({
        success: true,
        data: {
          ...competition,
          teams: teams || [],
        },
      });
    }

    // List user's team_v2 competitions
    if (userId) {
      const { data: participations, error: partError } = await supabase
        .from('competition_participants')
        .select('competition_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (partError) {
        return NextResponse.json(
          { error: 'Failed to fetch participations', details: partError.message },
          { status: 500 }
        );
      }

      const competitionIds = participations?.map(p => p.competition_id) || [];

      if (competitionIds.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      const { data: competitions, error: compError } = await supabase
        .from('competitions')
        .select(`
          *,
          creator:profiles!competitions_new_created_by_fkey(*)
        `)
        .in('id', competitionIds)
        .eq('competition_mode', 'team_v2')
        .order('created_at', { ascending: false });

      if (compError) {
        return NextResponse.json(
          { error: 'Failed to fetch competitions', details: compError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data: competitions });
    }

    // List all public team_v2 competitions
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select(`
        *,
        creator:profiles!competitions_new_created_by_fkey(*)
      `)
      .eq('competition_mode', 'team_v2')
      .eq('public', true)
      .in('status', ['draft', 'started'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch competitions', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: competitions });
  } catch (error: any) {
    console.error('[Team V2 API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create team_v2 competition
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();

    const {
      name,
      description,
      activity_type,
      start_date,
      end_date,
      max_teams,
      max_users_per_team,
      is_public,
      created_by,
    } = body;

    // Validate required fields
    if (!name || !activity_type || !start_date || !end_date || !created_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate activity_type
    if (!['weight', 'steps'].includes(activity_type)) {
      return NextResponse.json(
        { error: 'activity_type must be "weight" or "steps"' },
        { status: 400 }
      );
    }

    // Generate join code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    for (let i = 0; i < 6; i++) {
      joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create the competition
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .insert({
        name,
        description: description || null,
        activity_type,
        start_date,
        end_date,
        competition_mode: 'team_v2',
        max_teams: max_teams || 10,
        max_users_per_team: max_users_per_team || 10,
        public: is_public || false,
        join_code: joinCode,
        created_by,
        status: 'draft',
        scoring_method: activity_type === 'weight' ? 'total_value' : 'cumulative',
        ranking_direction: 'desc',
      })
      .select()
      .single();

    if (compError || !competition) {
      return NextResponse.json(
        { error: 'Failed to create competition', details: compError?.message },
        { status: 500 }
      );
    }

    // Add creator as participant
    await supabase
      .from('competition_participants')
      .insert({
        competition_id: competition.id,
        user_id: created_by,
        is_active: true,
        joined_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      data: competition,
    });
  } catch (error: any) {
    console.error('[Team V2 API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

