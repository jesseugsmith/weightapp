import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require specific permissions
const PROTECTED_ROUTES = {
  '/admin/users': 'manage_users',
  '/admin/invites': 'manage_invites',
  '/competitions/create': 'create_competitions',
  '/analytics': 'view_analytics'
} as const;

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Refresh the session if it exists
  const {
    data: { session },
  } = await supabase.auth.getSession();
  
  if (session) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Session refresh error:', error);
    }
  }

  // If there's no session and the user is trying to access a protected route
  if (!session && (request.nextUrl.pathname.startsWith('/home') || request.nextUrl.pathname.startsWith('/admin'))) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If there's a session and the user is trying to access auth pages
  if (session && (request.nextUrl.pathname.startsWith('/signin') || request.nextUrl.pathname.startsWith('/signup'))) {
    const redirectUrl = new URL('/home', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Check permissions for protected routes
  if (session) {
    const path = request.nextUrl.pathname;
    const requiredPermission = PROTECTED_ROUTES[path as keyof typeof PROTECTED_ROUTES];

    if (requiredPermission) {
      const { data: hasPermission, error } = await supabase.rpc('has_permission', {
        permission_name: requiredPermission
      });

      if (error || !hasPermission) {
        // Redirect to access denied page
        const redirectUrl = new URL('/access-denied', request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)'],
}
