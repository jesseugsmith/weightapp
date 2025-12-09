import { NextRequest, NextResponse } from 'next/server';
import { NovuService } from '@/lib/services/novu-service';
import { createClient } from '@supabase/supabase-js';

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
 * POST /api/novu/mobile/register-push
 * Register Expo push token with Novu (no database storage)
 * 
 * This endpoint is called by the mobile app (Challngr)
 * Mobile app sends Supabase auth token and Expo push token
 * 
 * Uses Novu's Expo provider integration for push notifications.
 * Make sure Expo integration is configured in Novu dashboard.
 * 
 * Headers:
 * - Authorization: Bearer <supabase-access-token>
 * 
 * Body:
 * - pushToken: string (Expo push token)
 * - deviceType: 'ios' | 'android'
 */
export async function POST(request: NextRequest) {
  try {
    // Get Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { 
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { pushToken, deviceType } = body;

    if (!pushToken) {
      return NextResponse.json(
        { error: 'pushToken is required' },
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    console.log('📱 Mobile app: Registering Expo push token for user', user.id);
    console.log('Device type:', deviceType);
    console.log('Token prefix:', pushToken.substring(0, 20) + '...');

    // Register Expo push token with Novu using Expo provider
    // Provider ID: 'expo' (Novu's Expo Push provider)
    const result = await NovuService.setCredentials(
      user.id, // Use Profile ID as subscriberId
      'expo', // Novu Expo provider
      {
        deviceTokens: [pushToken],
      }
    );

    if (!result.success) {
      // Check if error is due to missing Expo integration
      const errorMessage = result.error || '';
      const isMissingIntegration = 
        errorMessage.includes('do not have active') ||
        errorMessage.includes('integration') ||
        errorMessage.includes('provider');

      if (isMissingIntegration) {
        console.warn('⚠️ Expo integration not configured in Novu');
        console.warn('💡 To enable push notifications:');
        console.warn('   1. Go to Novu Dashboard → Settings → Integrations');
        console.warn('   2. Add "Expo Push" integration');
        console.warn('   3. Enter your EAS access token');
        console.warn('💡 In-app notifications will still work via Novu');
        
        // Return success but with a warning - don't block the app
        return NextResponse.json({
          success: true,
          message: 'Expo push token received but Expo integration not configured in Novu',
          warning: 'Configure Expo Push integration in Novu dashboard to enable push notifications',
          subscriberId: user.id,
        }, {
          headers: corsHeaders,
        });
      }

      // For other errors, return error response
      console.error('❌ Failed to register Expo push token with Novu:', result.error);
      return NextResponse.json(
        { 
          error: result.error || 'Failed to register push token with Novu',
          details: 'Check Novu dashboard for Expo integration configuration'
        },
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log('✅ Expo push token registered with Novu for subscriber:', user.id);

    return NextResponse.json({
      success: true,
      message: 'Expo push token registered successfully with Novu',
      subscriberId: user.id,
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('❌ Error in mobile register-push:', error);
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

