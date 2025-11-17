import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to register/update a subscriber with Novu
 * This is called during user registration or profile updates
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Register subscriber endpoint called');
    
    const { subscriberId, email, firstName, lastName } = await request.json();

    if (!subscriberId || !email) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { error: 'subscriberId and email are required' },
        { status: 400 }
      );
    }

    console.log('� Received request:', {
      subscriberId,
      email,
      firstName,
      lastName
    });

    // Get Novu API key from environment (server-side only)
    const novuApiKey = process.env.NOVU_API_KEY;

    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('📝 Registering/updating subscriber with Novu:', {
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

    console.log('📤 Sending to Novu API:', JSON.stringify(requestBody, null, 2));

    // Register/update subscriber with Novu (using v1 for consistency)
    const response = await fetch(
      `https://api.novu.co/v1/subscribers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    );

    console.log('📥 Novu API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu API error:', {
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
    console.log('✅ Subscriber registered/updated successfully:', {
      subscriberId,
      response: data
    });

    return NextResponse.json({
      success: true,
      message: 'Subscriber registered with Novu',
      data
    });

  } catch (error) {
    console.error('Error registering subscriber:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
