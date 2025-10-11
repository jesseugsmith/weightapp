import { NextRequest, NextResponse } from 'next/server';

/**
 * TEST ONLY - API endpoint to test Novu subscriber creation without auth
 * This endpoint should be removed in production
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TEST: Register subscriber endpoint called');
    
    const { subscriberId, email, firstName, lastName } = await request.json();

    if (!subscriberId || !email) {
      return NextResponse.json(
        { error: 'subscriberId and email are required' },
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

    console.log('📝 TEST: Registering subscriber with Novu:', {
      subscriberId,
      email,
      firstName,
      lastName
    });

    // Build full name
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

    const requestBody = {
      subscriberId: subscriberId,
      email: email,
      firstName: firstName || '',
      lastName: lastName || '',
      data: {
        fullName: fullName,
        registeredAt: new Date().toISOString(),
      }
    };

    console.log('📤 TEST: Sending to Novu API:', JSON.stringify(requestBody, null, 2));

    // Register/update subscriber with Novu
    const response = await fetch(
      `https://api.novu.co/v2/subscribers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('📥 TEST: Novu API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ TEST: Novu API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return NextResponse.json(
        { error: 'Failed to register with Novu', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ TEST: Subscriber registered successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Subscriber registered with Novu',
      data
    });

  } catch (error) {
    console.error('❌ TEST: Error registering subscriber:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
