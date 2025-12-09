import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/**
 * POST /api/novu/trigger-workflow
 * Trigger a Novu workflow
 * 
 * Body:
 * - workflowId: string
 * - subscriberId?: string (defaults to authenticated user)
 * - payload: Record<string, any>
 * - overrides?: { email?, sms?, inApp?, push? }
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
    const { workflowId, subscriberId, payload, overrides } = body;

    if (!workflowId || !payload) {
      return NextResponse.json(
        { error: 'workflowId and payload are required' },
        { status: 400 }
      );
    }

    // Use authenticated user ID if subscriberId not provided
    const targetSubscriberId = subscriberId || user.id;

    // Verify user can only trigger workflows for themselves
    // (unless they have admin permissions - can be added later)
    if (targetSubscriberId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot trigger workflow for another user' },
        { status: 403 }
      );
    }

    // Trigger workflow
    const result = await NovuService.triggerWorkflow(
      workflowId,
      targetSubscriberId,
      payload,
      overrides
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      message: 'Workflow triggered successfully',
    });
  } catch (error) {
    console.error('Error in trigger-workflow API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

