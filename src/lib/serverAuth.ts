import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import PocketBase from 'pocketbase';

/**
 * Server-side authentication utility for API routes
 * Verifies user session using PocketBase cookie
 */
export async function verifyAuth(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const pbAuth = cookieStore.get('pb_auth');
    
    if (!pbAuth) {
      return null;
    }

    // Initialize PocketBase on server-side
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');
    
    // Load auth from cookie
    pb.authStore.loadFromCookie(pbAuth.value);
    
    // Verify the token is valid
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null;
    }

    return pb.authStore.model;
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * Get authenticated PocketBase instance for server-side operations
 */
export async function getAuthenticatedPB(): Promise<{ pb: PocketBase; user: any } | null> {
  try {
    const cookieStore = await cookies();
    const pbAuth = cookieStore.get('pb_auth');
    
    if (!pbAuth) {
      return null;
    }

    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');
    pb.authStore.loadFromCookie(pbAuth.value);
    
    if (!pb.authStore.isValid || !pb.authStore.model) {
      return null;
    }

    return { pb, user: pb.authStore.model };
  } catch (error) {
    console.error('Error getting authenticated PocketBase:', error);
    return null;
  }
}
