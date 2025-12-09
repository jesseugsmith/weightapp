import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createClient } from '@supabase/supabase-js';
import { log401, getRequestContext, getEnvStatus, sanitizeRequestBody } from '@/lib/apiLogger';

/**
 * POST /api/novu/mobile/register-subscriber
 * Register subscriber for mobile app
 * 
 * This endpoint is called by the mobile app (Challngr)
 * Mobile app sends Supabase auth token, we verify and register with Novu
 * 
 * Headers:
 * - Authorization: Bearer <supabase-access-token>
 * 
 * Body:
 * - email?: string
 * - firstName?: string
 * - lastName?: string
 * - phone?: string
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body first for logging
    let body: any = {};
    let sanitizedBody: any = {};
    try {
      body = await request.json();
      sanitizedBody = sanitizeRequestBody(body);
    } catch (e) {
      // Body parsing failed, continue without it
    }

    // Get Authorization header (check both cases)
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log401({
        ...getRequestContext(request, '/api/novu/mobile/register-subscriber'),
        authMethod: 'none',
        reason: 'Missing or invalid Authorization header',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        hasAuthHeader: !!authHeader,
        authHeaderFormat: authHeader ? 'Not Bearer' : 'Missing'
      });
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      log401({
        ...getRequestContext(request, '/api/novu/mobile/register-subscriber'),
        authMethod: 'supabase_token',
        reason: 'Missing Supabase environment variables',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        error: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey
        }
      });
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      log401({
        ...getRequestContext(request, '/api/novu/mobile/register-subscriber'),
        authMethod: 'supabase_token',
        reason: authError ? `Supabase auth error: ${authError.message}` : 'No user returned from token',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        tokenPreview: token.substring(0, 10) + '...',
        error: authError ? {
          message: authError.message,
          status: authError.status,
          name: authError.name
        } : 'No user object'
      });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const { email, firstName, lastName, phone } = body;

    console.log('📱 Mobile app: Registering subscriber', user.id);

    // Register subscriber with Novu
    const result = await NovuService.identifySubscriber(
      user.id,
      email || user.email,
      firstName,
      lastName,
      phone
    );

    if (!result.success) {
      console.error('❌ Failed to register subscriber:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log('✅ Mobile subscriber registered successfully');

    return NextResponse.json({
      success: true,
      message: 'Subscriber registered successfully',
      subscriberId: user.id,
    });
  } catch (error) {
    console.error('❌ Error in mobile register-subscriber:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

