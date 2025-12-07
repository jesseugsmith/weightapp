import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processOneSignalQueue } from '@/lib/notifications/onesignalQueue';

type AuthContext = {
  searchParams: URLSearchParams;
  isVercelCron: boolean;
  isServiceKeyAuth: boolean;
  serviceRoleKey?: string;
};

function getAuthContext(request: NextRequest): AuthContext {
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const cronSecret = process.env.CRON_SECRET;
  const cronSecretParam = searchParams.get('cron_secret');
  const headerToken = authHeader?.replace('Bearer ', '');

  const isVercelCron =
    !!cronSecret &&
    (cronSecretParam === cronSecret || authHeader === `Bearer ${cronSecret}`);

  const serviceRoleKey =
    headerToken && headerToken !== cronSecret
      ? headerToken
      : process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isServiceKeyAuth =
    !!serviceRoleKey && (!authHeader || authHeader === `Bearer ${serviceRoleKey}`);

  return { searchParams, isVercelCron, isServiceKeyAuth, serviceRoleKey };
}

function parseBatchSize(searchParams: URLSearchParams): number {
  const parsed = parseInt(searchParams.get('batchSize') ?? '50', 10);
  return Number.isFinite(parsed) ? parsed : 50;
}

function getSupabaseClient(serviceRoleKey?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * POST: Process the notification queue and send to OneSignal.
 * Auth: CRON_SECRET (header or query) or service role key in Authorization header.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams, isVercelCron, isServiceKeyAuth, serviceRoleKey } = getAuthContext(request);

    if (!isVercelCron && !isServiceKeyAuth) {
      return NextResponse.json(
        { error: 'Unauthorized - Service key or cron secret required' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient(serviceRoleKey);
    const batchSize = parseBatchSize(searchParams);

    const result = await processOneSignalQueue({
      batchSize,
      supabaseClient: supabase,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error processing notification queue:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Status endpoint. If CRON_SECRET is provided, it triggers processing.
 * Otherwise, with service role key auth, it returns queue counts.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams, isVercelCron, isServiceKeyAuth, serviceRoleKey } = getAuthContext(request);

    if (!isVercelCron && !isServiceKeyAuth) {
      return NextResponse.json(
        { error: 'Unauthorized - Service key or cron secret required' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient(serviceRoleKey);

    if (isVercelCron) {
      const batchSize = parseBatchSize(searchParams);
      const result = await processOneSignalQueue({
        batchSize,
        supabaseClient: supabase,
      });
      return NextResponse.json(result);
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('push_sent_at', null)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch queue status', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queued: count || 0,
      message: `There are ${count || 0} notifications pending`,
    });
  } catch (error) {
    console.error('❌ Error checking notification queue:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

