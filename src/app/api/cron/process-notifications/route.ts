import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job to process notification queue
 * This endpoint is called by Vercel Cron every 2 minutes
 * It wraps the main process-queue endpoint with proper authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Notification queue processing cron job triggered');

    // Call the main Novu process-queue endpoint (replaces OneSignal)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/novu/process-queue?batchSize=50&secret=${process.env.CRON_SECRET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to process notification queue:', errorText);
      return NextResponse.json(
        { error: 'Failed to process notification queue', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('✅ Notification queue processed successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Notification queue processed',
      timestamp: new Date().toISOString(),
      data
    });

  } catch (error) {
    console.error('❌ Error in notification queue cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

