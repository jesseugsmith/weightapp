import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';

/**
 * API endpoint to send a test notification with first and last name
 * This demonstrates sending notifications via Novu with user profile data
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get Supabase client
    const authResult = await getAuthenticatedSupabase(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { supabase, user } = authResult;

    // Get Novu API key from environment (server-side only)
    const novuApiKey = process.env.NOVU_API_KEY;

    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get user profile for first and last name
    let firstName = '';
    let lastName = '';

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();
      
      if (!error && profile) {
        firstName = profile.first_name || '';
        lastName = profile.last_name || '';
      }
    } catch (error) {
      console.warn('Profile not found, using empty names');
    }

    console.log(`Sending test notification to user: ${user.id} (${firstName} ${lastName})`);

    // Send test notification via Novu
    const response = await fetch(
      `https://api.novu.co/v1/events/trigger`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'test-notification', // This workflow ID must exist in Novu
          to: {
            subscriberId: user.id,
            email: user.email,
            firstName: firstName,
            lastName: lastName
          },
          payload: {
            title: 'Test Notification',
            message: `Hello ${firstName || 'there'}! This is a test notification from challngr.`,
            firstName: firstName,
            lastName: lastName,
            testTime: new Date().toISOString()
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Novu API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send notification', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Test notification sent successfully:', user.id);

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      data: {
        firstName,
        lastName,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}