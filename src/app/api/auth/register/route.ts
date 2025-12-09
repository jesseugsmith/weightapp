import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { log401, getRequestContext, logApi, getEnvStatus, sanitizeRequestBody } from '@/lib/apiLogger';

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
 * POST /api/auth/register
 * Register a new user account
 * 
 * Body:
 *   email: string (required)
 *   password: string (required, min 6 characters)
 *   firstName: string (optional)
 *   lastName: string (optional)
 * 
 * Response:
 *   success: boolean
 *   user: User object (if successful)
 *   error: string (if failed)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const { email, password, firstName, lastName } = body;
    
    const requestContext = getRequestContext(request, '/api/auth/register');
    logApi({
      ...requestContext,
      status: 200,
      message: 'Registration request received',
      requestBody: sanitizedBody,
      env: getEnvStatus()
    });

    // Validate required fields
    if (!email || !password) {
      console.error('❌ Missing required fields');
      return NextResponse.json(
        { 
          success: false,
          error: 'Email and password are required' 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid email format' 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Password must be at least 6 characters' 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    console.log('📝 Registering user:', {
      email,
      hasPassword: !!password,
      firstName,
      lastName
    });

    // Create Supabase client for server-side operations
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie setting errors in API routes
            }
          },
        },
      }
    );

    // Determine the app URL for email redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                   request.headers.get('origin') ||
                   'http://localhost:3000';
    
    const emailRedirectTo = `${appUrl}/auth/callback`;

    // Register the user with Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName || '',
          last_name: lastName || '',
        },
        emailRedirectTo,
      },
    });

    if (error) {
      console.error('❌ Supabase signup error:', error);
      return NextResponse.json(
        { 
          success: false,
          error: error.message || 'Failed to create account' 
        },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    if (!data.user) {
      console.error('❌ No user returned from signup');
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create account' 
        },
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log('✅ User registered successfully:', {
      userId: data.user.id,
      email: data.user.email
    });

    // Optionally register with Novu if configured
    if (process.env.NOVU_API_KEY && data.user.email) {
      try {
        console.log('📝 Registering subscriber with Novu...');
        const novuResponse = await fetch(
          `https://api.novu.co/v1/subscribers`,
          {
            method: 'POST',
            headers: {
              'Authorization': `ApiKey ${process.env.NOVU_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscriberId: data.user.id,
              email: data.user.email,
              firstName: firstName || '',
              lastName: lastName || '',
              data: {
                fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0],
                registeredAt: new Date().toISOString(),
              }
            })
          }
        );

        if (novuResponse.ok) {
          console.log('✅ Subscriber registered with Novu');
        } else {
          console.warn('⚠️ Failed to register with Novu (non-critical):', await novuResponse.text());
        }
      } catch (novuError) {
        // Don't fail registration if Novu registration fails
        console.warn('⚠️ Novu registration error (non-critical):', novuError);
      }
    }

    // Return success response
    // Note: Supabase may not return a session if email confirmation is required
    return NextResponse.json({
      success: true,
      message: data.session 
        ? 'Account created successfully' 
        : 'Account created successfully. Please check your email to verify your account.',
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: data.user.email_confirmed_at !== null,
        createdAt: data.user.created_at,
      },
      session: data.session ? {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      } : null,
    }, { 
      status: 201,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('❌ Error registering user:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { 
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}

