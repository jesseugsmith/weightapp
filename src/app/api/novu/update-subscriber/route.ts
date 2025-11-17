import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to update subscriber information in Novu
 * This is called when user updates their profile
 */
export async function PUT(request: NextRequest) {
  try {
    const { subscriberId, email, firstName, lastName } = await request.json();

    if (!subscriberId || !email) {
      return NextResponse.json(
        { error: 'subscriberId and email are required' },
        { status: 400 }
      );
    }

    console.log('📝 Update subscriber request:', {
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

    console.log('Updating subscriber in Novu:', subscriberId);

    // Build full name
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

    // Update subscriber with Novu (use PATCH for v2 API)
    const response = await fetch(
      `https://api.novu.co/v2/subscribers/${subscriberId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `ApiKey ${novuApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          firstName: firstName || '',
          lastName: lastName || '',
          data: {
            fullName: fullName,
            updatedAt: new Date().toISOString(),
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Novu API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update subscriber in Novu', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('Subscriber updated successfully:', subscriberId);

    return NextResponse.json({
      success: true,
      message: 'Subscriber updated in Novu',
      data
    });

  } catch (error) {
    console.error('Error updating subscriber:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
