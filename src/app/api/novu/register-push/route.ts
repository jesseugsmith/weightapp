import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to register push notification credentials with Novu
 * This proxies the request to Novu's API using the server-side API key
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'Missing userId or subscription' },
        { status: 400 }
      );
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

    console.log('Registering push credentials for subscriber:', userId);

    // Register push credentials with Novu
    const response = await fetch(
      `https://api.novu.co/v1/subscribers/${userId}/credentials`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: 'web-push', // Web Push API (works across all browsers)
          credentials: {
            deviceTokens: [JSON.stringify(subscription)]
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Novu API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to register with Novu', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Push credentials registered successfully for:', userId);

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
