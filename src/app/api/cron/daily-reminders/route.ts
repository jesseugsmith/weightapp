import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job to send daily competition reminders
 * This endpoint is called by Vercel Cron at a scheduled time
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Daily competition reminder cron job triggered');

    // Call the daily reminder workflow
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/novu/workflows/daily-reminder`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_KEY || ''}`,
        },
        body: JSON.stringify({
          trigger: 'cron',
          timestamp: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to trigger daily reminders:', errorText);
      return NextResponse.json(
        { error: 'Failed to send daily reminders', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('✅ Daily competition reminders triggered successfully');

    return NextResponse.json({
      success: true,
      message: 'Daily competition reminders sent',
      timestamp: new Date().toISOString(),
      data
    });

  } catch (error) {
    console.error('❌ Error in daily reminder cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}