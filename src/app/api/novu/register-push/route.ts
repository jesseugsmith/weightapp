import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to register push notification credentials with Novu
 * This proxies the request to Novu's API using the server-side API key
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, subscription, isSimulator } = await request.json();

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'Missing userId or subscription' },
        { status: 400 }
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
    console.log('📱 Registering push credentials for subscriber:', userId);
    console.log('📱 Subscription:', JSON.stringify(subscription, null, 2));
    console.log('🌐 Calling Novu API:', novuApiUrl);

    // For web push (browser native), we use push-webhook provider
    // For FCM, you'd need Firebase SDK to get FCM tokens
    const response = await fetch(novuApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `ApiKey ${novuApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId: 'push-webhook', // Web push provider (change if using FCM)
        credentials: {
          deviceTokens: [JSON.stringify(subscription)]
        }
      })
    });

    console.log('📱 Novu push API response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu push API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return NextResponse.json(
        { error: 'Failed to register push with Novu', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Push credentials registered successfully for:', userId);

    return NextResponse.json({
      success: true,
      message: 'Push credentials registered',
      data
    });

  } catch (error) {
    console.error('Error registering push credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
