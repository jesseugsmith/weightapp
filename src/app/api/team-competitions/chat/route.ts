/**
 * Team V2 Chat API
 * Handles chat messages for team_v2 competitions
 * Supports both team-only and competition-wide chat
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ============================================================================
// GET - Get chat messages
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get('competitionId');
    const teamId = searchParams.get('teamId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    if (!competitionId) {
      return NextResponse.json(
        { error: 'competitionId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('competition_chat_messages')
      .select(`
        *,
        user:profiles(*),
        team:competition_teams(name, team_code)
      `)
      .eq('competition_id', competitionId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by team or competition-wide
    if (teamId) {
      // Team chat
      query = query.eq('team_id', teamId);
    } else {
      // Competition-wide chat
      query = query.is('team_id', null);
    }

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch messages', details: error.message },
        { status: 500 }
      );
    }

    // Reverse to get chronological order
    return NextResponse.json({
      success: true,
      data: (data || []).reverse(),
    });
  } catch (error: any) {
    console.error('[Chat API] GET Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Send a chat message
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();

    const { competition_id, team_id, user_id, message, message_type } = body;

    if (!competition_id || !user_id || !message) {
      return NextResponse.json(
        { error: 'competition_id, user_id, and message are required' },
        { status: 400 }
      );
    }

    // If team_id is provided, verify user is a member of that team
    if (team_id) {
      const { data: membership, error: memberError } = await supabase
        .from('competition_team_members')
        .select('id')
        .eq('competition_team_id', team_id)
        .eq('user_id', user_id)
        .eq('is_active', true)
        .single();

      if (memberError || !membership) {
        return NextResponse.json(
          { error: 'You are not a member of this team' },
          { status: 403 }
        );
      }
    } else {
      // For competition-wide chat, verify user is a participant
      const { data: participant, error: partError } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', competition_id)
        .eq('user_id', user_id)
        .eq('is_active', true)
        .single();

      if (partError || !participant) {
        return NextResponse.json(
          { error: 'You are not a participant in this competition' },
          { status: 403 }
        );
      }
    }

    // Insert message
    const { data: chatMessage, error: insertError } = await supabase
      .from('competition_chat_messages')
      .insert({
        competition_id,
        team_id: team_id || null,
        user_id,
        message,
        message_type: message_type || 'message',
      })
      .select(`
        *,
        user:profiles(*),
        team:competition_teams(name, team_code)
      `)
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to send message', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chatMessage,
    });
  } catch (error: any) {
    console.error('[Chat API] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Edit a message
// ============================================================================
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();

    const { message_id, user_id, message } = body;

    if (!message_id || !user_id || !message) {
      return NextResponse.json(
        { error: 'message_id, user_id, and message are required' },
        { status: 400 }
      );
    }

    // Verify user owns the message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('competition_chat_messages')
      .select('user_id')
      .eq('id', message_id)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (existingMessage.user_id !== user_id) {
      return NextResponse.json(
        { error: 'You can only edit your own messages' },
        { status: 403 }
      );
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabase
      .from('competition_chat_messages')
      .update({
        message,
        edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', message_id)
      .select(`
        *,
        user:profiles(*),
        team:competition_teams(name, team_code)
      `)
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to edit message', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedMessage,
    });
  } catch (error: any) {
    console.error('[Chat API] PATCH Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Soft delete a message
// ============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const userId = searchParams.get('userId');

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'messageId and userId are required' },
        { status: 400 }
      );
    }

    // Verify user owns the message
    const { data: existingMessage, error: fetchError } = await supabase
      .from('competition_chat_messages')
      .select('user_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !existingMessage) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (existingMessage.user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only delete your own messages' },
        { status: 403 }
      );
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('competition_chat_messages')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete message', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Chat API] DELETE Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

