import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Get authenticated Supabase instance for server-side operations
 * Reads auth token from Authorization header or cookies
 */
export async function getAuthenticatedSupabase(request: NextRequest): Promise<{ supabase: any; user: any } | null> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    console.log('🔍 Auth header check:', {
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

    // Create Supabase server client
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    console.log('💾 Supabase client created');
    
    // Verify the token by fetching the user
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('❌ Token validation failed:', error?.message);
        return null;
      }
      
      console.log('✅ Auth verified for user:', user.id);
      return { supabase, user };
    } catch (verifyError: any) {
      console.error('❌ Token verification failed:', {
        message: verifyError.message
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting authenticated Supabase:', error);
    return null;
  }
}

// Keep old function name for backward compatibility
export const getAuthenticatedPB = getAuthenticatedSupabase;
