import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/serverAuth';

/**
 * API endpoint to update subscriber information in Novu
 * This is called when user updates their profile
 */
export async function PUT(request: NextRequest) {
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

    // Get Novu API key from environment (server-side only)
    const novuApiKey = process.env.NOVU_API_KEY;

    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    console.log('Updating subscriber in Novu:', user.id);

    // Build full name
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

    // Update subscriber with Novu
    const response = await fetch(
      `https://api.novu.co/v1/subscribers/${user.id}`,
      {
        method: 'PUT',
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
    console.log('Subscriber updated successfully:', user.id);

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
