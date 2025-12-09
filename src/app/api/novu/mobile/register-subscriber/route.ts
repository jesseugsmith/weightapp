import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createClient } from '@supabase/supabase-js';
import { log401, getRequestContext, getEnvStatus, sanitizeRequestBody } from '@/lib/apiLogger';

/**
 * CORS headers for API responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400',
    },
  });
}

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
    // Log ALL headers for debugging (especially to detect Cloudflare stripping)
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = key.toLowerCase() === 'authorization' 
        ? value.substring(0, 20) + '...' 
        : value;
    });
    console.log('📋 All incoming headers:', JSON.stringify(allHeaders, null, 2));
    console.log('🔍 Cloudflare headers:', {
      cfRay: request.headers.get('cf-ray'),
      cfConnectingIp: request.headers.get('cf-connecting-ip'),
      cfVisitor: request.headers.get('cf-visitor'),
      via: request.headers.get('via'),
    });

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
        { 
          status: 401,
          headers: corsHeaders,
        }
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
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }
    
    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });
    } catch (clientError) {
      console.error('❌ Error creating Supabase client:', clientError);
      log401({
        ...getRequestContext(request, '/api/novu/mobile/register-subscriber'),
        authMethod: 'supabase_token',
        reason: 'Failed to create Supabase client',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        tokenPreview: token.substring(0, 10) + '...',
        error: clientError instanceof Error ? {
          message: clientError.message,
          name: clientError.name
        } : String(clientError)
      });
      return NextResponse.json(
        { error: 'Authentication service error' },
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    let user, authError;
    try {
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user;
      authError = authResult.error;
    } catch (getUserError) {
      console.error('❌ Exception calling supabase.auth.getUser():', getUserError);
      log401({
        ...getRequestContext(request, '/api/novu/mobile/register-subscriber'),
        authMethod: 'supabase_token',
        reason: 'Exception during Supabase auth',
        requestBody: sanitizedBody,
        env: getEnvStatus(),
        tokenPreview: token.substring(0, 10) + '...',
        error: getUserError instanceof Error ? {
          message: getUserError.message,
          name: getUserError.name,
          stack: getUserError.stack
        } : String(getUserError)
      });
      return NextResponse.json(
        { error: 'Authentication failed' },
        { 
          status: 401,
          headers: corsHeaders,
        }
      );
    }

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
        { 
          status: 401,
          headers: corsHeaders,
        }
      );
    }
    const { email, firstName, lastName, phone } = body;

    console.log('📱 Mobile app: Registering subscriber', user.id);
    console.log('📋 Subscriber data:', { 
      userId: user.id, 
      email: email || user.email, 
      firstName, 
      lastName, 
      phone 
    });

    // Register subscriber with Novu
    let result;
    try {
      console.log('🔔 Calling NovuService.identifySubscriber...');
      result = await NovuService.identifySubscriber(
        user.id,
        email || user.email,
        firstName,
        lastName,
        phone
      );
      console.log('✅ NovuService.identifySubscriber completed:', { success: result.success });
    } catch (novuError) {
      console.error('❌ Exception calling NovuService.identifySubscriber:', novuError);
      console.error('❌ Error stack:', novuError instanceof Error ? novuError.stack : 'No stack');
      return NextResponse.json(
        { 
          error: 'Failed to register subscriber with Novu',
          details: novuError instanceof Error ? novuError.message : String(novuError)
        },
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    if (!result.success) {
      console.error('❌ Failed to register subscriber:', result.error);
      return NextResponse.json(
        { 
          error: result.error || 'Failed to register subscriber',
          details: 'Novu service returned failure'
        },
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log('✅ Mobile subscriber registered successfully');

    return NextResponse.json({
      success: true,
      message: 'Subscriber registered successfully',
      subscriberId: user.id,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('❌ Error in mobile register-subscriber:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

