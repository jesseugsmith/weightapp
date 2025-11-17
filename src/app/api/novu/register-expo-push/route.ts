import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';

/**
 * API endpoint to register Expo push notification token with Novu
 * This integrates mobile push notifications with the existing Novu setup
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

    const { user } = authResult;
    const { userId, expoPushToken, isSimulator } = await request.json();

    if (!userId || !expoPushToken) {
      return NextResponse.json(
        { error: 'Missing userId or expoPushToken' },
        { status: 400 }
      );
    }

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // Skip registration if running on simulator
    if (isSimulator === true) {
      console.log('⏭️ Skipping Novu push registration - running on simulator');
      console.log('📱 Simulator detected for user:', userId);
      return NextResponse.json({
        success: true,
        message: 'Skipped push registration (simulator)',
        skipped: true
      });
    }

    // Get Novu API key from environment (server-side only)
    const novuApiKey = process.env.NOVU_API_KEY;

    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const novuApiUrl = `https://api.novu.co/v1/subscribers/${userId}/credentials`;
    console.log('📱 Registering Expo push token for subscriber:', userId);
    console.log('📱 Expo Push Token:', expoPushToken);
    console.log('🌐 Calling Novu API:', novuApiUrl);

    // Register Expo push token with Novu using the expo provider
    const response = await fetch(novuApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `ApiKey ${novuApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId: 'expo', // Novu's Expo provider
        credentials: {
          deviceTokens: [expoPushToken]
        }
      })
    });

    console.log('📱 Novu Expo API response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu Expo API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return NextResponse.json(
        { error: 'Failed to register Expo token with Novu', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Expo push token registered successfully for:', userId);

    return NextResponse.json({
      success: true,
      message: 'Expo push token registered',
      data
    });

  } catch (error) {
    console.error('Error registering Expo push token:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}