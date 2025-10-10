import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';

/**
 * API endpoint to register/update a subscriber with Novu
 * This is called during user registration or profile updates
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { email, firstName, lastName } = await request.json();

    // Verify the email matches the authenticated user
    if (email !== user.email) {
      return NextResponse.json(
        { error: 'Forbidden: Email mismatch' },
        { status: 403 }
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

    console.log('Registering/updating subscriber with Novu:', user.id);

    // Build full name
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

    // Register/update subscriber with Novu
    const response = await fetch(
      `https://api.novu.co/v1/subscribers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberId: user.id,
          email: email,
          firstName: firstName || '',
          lastName: lastName || '',
          data: {
            fullName: fullName,
            registeredAt: new Date().toISOString(),
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
    console.log('Subscriber registered/updated successfully:', user.id);

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
