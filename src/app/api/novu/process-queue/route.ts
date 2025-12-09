import { NextRequest, NextResponse } from 'next/server';
import { processNovuQueue } from '@/lib/notifications/novuQueue';

/**
 * POST /api/novu/process-queue
 * Process queued notifications via Novu workflows
 * 
 * This replaces the old OneSignal queue processor
 * Can be called manually or via cron job
 * 
 * Query params:
 * - batchSize?: number (default: 50, max: 100)
 * - secret?: string (for cron authentication)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if provided
    const searchParams = request.nextUrl.searchParams;
    const cronSecret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    // If cron secret is configured, verify it
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get batch size from query params
    const batchSize = parseInt(searchParams.get('batchSize') || '50', 10);

    console.log('🚀 Processing Novu notification queue...');
    console.log('Batch size:', batchSize);

    // Process the queue
    const result = await processNovuQueue({ batchSize });

    console.log('✅ Queue processing complete:', result.message);
    
    if (result.errors && result.errors.length > 0) {
      console.error('⚠️ Some notifications failed:', result.errors);
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      stats: {
        total: result.total,
        processed: result.processed,
        sent: result.sent,
        skipped: result.skipped,
        failed: result.failed,
      },
      errors: result.errors,
    });
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
 * GET /api/novu/process-queue
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Novu queue processor is running',
    timestamp: new Date().toISOString(),
  });
}

