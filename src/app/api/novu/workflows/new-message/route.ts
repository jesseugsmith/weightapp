import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';

/**
 * API endpoint to send notification when a user receives a new competition message
 * This is typically called by Supabase database functions/triggers
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      recipientUserId, 
      senderUserId, 
      competitionId, 
      competitionName, 
      messageText,
      messageId 
    } = await request.json();

    if (!recipientUserId || !senderUserId || !competitionId || !messageText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Novu API key from environment
    const novuApiKey = process.env.NOVU_API_KEY;
    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get sender profile info
    const authResult = await getAuthenticatedSupabase(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { supabase } = authResult;

    // Get sender name
    let senderName = 'Someone';
    try {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', senderUserId)
        .single();
      
      if (senderProfile) {
        senderName = [senderProfile.first_name, senderProfile.last_name]
          .filter(Boolean)
          .join(' ') || 'Someone';
      }
    } catch (error) {
      console.warn('Could not fetch sender profile:', error);
    }

    console.log(`📱 Sending new message notification: ${senderName} -> ${recipientUserId} in ${competitionName}`);

    // Trigger Novu notification
    const response = await fetch('https://api.novu.co/v1/events/trigger', {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${novuApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'new-competition-message',
        to: {
          subscriberId: recipientUserId,
        },
        payload: {
          senderName,
          competitionName: competitionName || 'Competition',
          messageText: messageText.length > 100 ? messageText.substring(0, 97) + '...' : messageText,
          competitionId,
          messageId,
          actionUrl: `/competition/${competitionId}/chat`,
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send notification', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ New message notification sent successfully');

    return NextResponse.json({
      success: true,
      message: 'New message notification sent',
      data
    });

  } catch (error) {
    console.error('❌ Error sending new message notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}