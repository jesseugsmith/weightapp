import { NextRequest } from 'next/server';
import PocketBase from 'pocketbase';

/**
 * Get authenticated PocketBase instance for server-side operations
 * Reads auth token from Authorization header
 */
export async function getAuthenticatedPB(request: NextRequest): Promise<{ pb: PocketBase; user: any } | null> {
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

    // Initialize PocketBase and set the token
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');
    pb.authStore.save(token, null);
    
    console.log('💾 Token saved to authStore');
    
    // Verify the token by fetching the user
    try {
      const authData = await pb.collection('users').authRefresh();
      
      if (!authData || !authData.record) {
        console.log('❌ Token validation failed - no auth data');
        return null;
      }
      
      console.log('✅ Auth verified for user:', authData.record.id);
      return { pb, user: authData.record };
    } catch (refreshError: any) {
      console.error('❌ Token refresh failed:', {
        message: refreshError.message,
        status: refreshError.status,
        data: refreshError.data
      });
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting authenticated PocketBase:', error);
    return null;
  }
}
