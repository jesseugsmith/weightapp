import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createRouteHandlerClient } from '@/lib/supabaseServer';
import { log401, getRequestContext, getEnvStatus, sanitizeRequestBody } from '@/lib/apiLogger';

/**
 * POST /api/novu/register-subscriber
 * Register a new subscriber with Novu
 * 
 * Body:
 * - subscriberId: string (user ID)
 * - email?: string
 * - firstName?: string
 * - lastName?: string
 * - phone?: string
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body first for logging
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);

    // Verify authentication
    const supabase = createRouteHandlerClient(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log401({
        ...getRequestContext(request, '/api/novu/register-subscriber'),
        authMethod: 'session',
        reason: authError ? `Supabase auth error: ${authError.message}` : 'No user returned from session',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        error: authError ? {
          message: authError.message,
          status: authError.status,
          name: authError.name
        } : 'No user object',
        cookies: request.headers.get('cookie') ? 'Present' : 'Missing'
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { subscriberId, email, firstName, lastName, phone } = body;

    // Verify the subscriberId matches the authenticated user
    if (subscriberId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot register another user' },
        { status: 403 }
      );
    }

    if (!subscriberId) {
      return NextResponse.json(
        { error: 'subscriberId is required' },
        { status: 400 }
      );
    }

    // Register subscriber with Novu
    const result = await NovuService.identifySubscriber(
      subscriberId,
      email,
      firstName,
      lastName,
      phone
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscriberId,
      message: 'Subscriber registered successfully',
    });
  } catch (error) {
    console.error('Error in register-subscriber API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

