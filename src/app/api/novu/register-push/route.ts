import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/**
 * POST /api/novu/register-push
 * Register push notification credentials with Novu
 * 
 * Body:
 * - userId: string
 * - subscription: PushSubscription (web push subscription object)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, subscription } = body;

    // Verify the userId matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot register push for another user' },
        { status: 403 }
      );
    }

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'userId and subscription are required' },
        { status: 400 }
      );
    }

    // Convert push subscription to device token format for Novu
    // For web push, we'll use the endpoint as the device token
    const deviceToken = subscription.endpoint;

    // Register push credentials with Novu
    // Using 'fcm' provider ID for web push (Novu handles web push via FCM)
    const result = await NovuService.setCredentials(
      userId,
      'fcm', // Provider ID for web push
      {
        deviceTokens: [deviceToken],
        webhookUrl: subscription.endpoint,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push credentials registered successfully',
    });
  } catch (error) {
    console.error('Error in register-push API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

