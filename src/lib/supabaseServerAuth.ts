import { NextRequest } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabaseServer';

/**
 * Get authenticated user for server-side operations (Supabase version)
 * Reads auth session from cookies
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    console.log('🔍 Checking authentication...');
    
    // Create Supabase client with request cookies
    const supabase = createRouteHandlerClient(request);
    
    // Get the current user from the session
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.log('❌ No authenticated user:', error?.message);
      return null;
    }

    console.log('✅ Authenticated user:', user.id, user.email);
    
    return user;
  } catch (error) {
    console.error('❌ Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Get authenticated user with profile data
 */
export async function getAuthenticatedUserWithProfile(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient(request);
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('❌ No authenticated user');
      return null;
    }

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.warn('⚠️ Profile not found:', profileError.message);
      // Return user without profile
      return { user, profile: null };
    }

    console.log('✅ Authenticated user with profile:', user.id);
    return { user, profile };
  } catch (error) {
    console.error('❌ Error getting authenticated user with profile:', error);
    return null;
  }
}

/**
 * Verify API token authentication (for API token-based auth)
 * This is for endpoints that accept Bearer tokens from API tokens table
 */
export async function verifyApiToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    console.log('🔍 API Token check:', {
      hasHeader: !!authHeader,
      headerStart: authHeader?.substring(0, 20)
    });
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No Authorization header found');
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    
    console.log('🔑 Token extracted:', {
      length: token.length,
      start: token.substring(0, 10)
    });
    
    if (!token) {
      console.log('❌ No token in Authorization header');
      return null;
    }

    // Use service role key to query api_tokens (bypass RLS)
    const supabase = createRouteHandlerClient(request);
    
    // Query the api_tokens table
    const { data: apiToken, error } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (error || !apiToken) {
      console.log('❌ Invalid or inactive token');
      return null;
    }

    console.log('✅ Token validated:', {
      id: apiToken.id,
      name: apiToken.name,
      user_id: apiToken.user_id
    });

    // Check if token has expired
    if (apiToken.expires_at) {
      const expirationDate = new Date(apiToken.expires_at);
      const now = new Date();
      
      console.log('📅 Checking expiration:', {
        expires_at: apiToken.expires_at,
        isExpired: expirationDate < now
      });
      
      if (expirationDate < now) {
        console.log('❌ Token has expired');
        return null;
      }
    }

    // Update last_used_at timestamp
    await supabase
      .from('api_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiToken.id);

    return apiToken;
  } catch (error) {
    console.error('❌ Error verifying API token:', error);
    return null;
  }
}
