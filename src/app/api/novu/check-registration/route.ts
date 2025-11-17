import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSupabase } from '@/lib/serverAuth';

/**
 * API endpoint to check if a user is registered with Novu and their device tokens
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await getAuthenticatedSupabase(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const { userId } = await request.json();

    // Verify the userId matches the authenticated user
    if (userId && userId !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    const subscriberId = userId || user.id;

    // Get Novu API key
    const novuApiKey = process.env.NOVU_API_KEY;
    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('🔍 Checking Novu registration for subscriber:', subscriberId);

    // Check subscriber status in Novu
    const response = await fetch(
      `https://api.novu.co/v1/subscribers/${subscriberId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📊 Novu subscriber check response:', response.status, response.statusText);

    if (response.status === 404) {
      return NextResponse.json({
        registered: false,
        subscriber: null,
        message: 'Subscriber not found in Novu'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to check Novu registration', details: errorText },
        { status: response.status }
      );
    }

    const subscriberData = await response.json();
    console.log('✅ Subscriber found:', subscriberData.subscriberId);

    // Extract relevant information
    const hasExpoPushToken = subscriberData.channels?.some((channel: any) => 
      channel.providerId === 'expo' && channel.credentials?.deviceTokens?.length > 0
    );

    const pushTokens = subscriberData.channels
      ?.filter((channel: any) => channel.providerId === 'expo')
      ?.flatMap((channel: any) => channel.credentials?.deviceTokens || []) || [];

    return NextResponse.json({
      registered: true,
      subscriber: {
        subscriberId: subscriberData.subscriberId,
        email: subscriberData.email,
        firstName: subscriberData.firstName,
        lastName: subscriberData.lastName,
        data: subscriberData.data
      },
      pushNotifications: {
        hasExpoPushToken,
        tokenCount: pushTokens.length,
        tokens: pushTokens.map((token: string) => ({
          token: token.substring(0, 20) + '...',
          fullToken: token
        }))
      },
      channels: subscriberData.channels?.map((channel: any) => ({
        providerId: channel.providerId,
        integrationIdentifier: channel.integrationIdentifier,
        hasCredentials: !!channel.credentials
      })) || []
    });

  } catch (error) {
    console.error('❌ Error checking Novu registration:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}