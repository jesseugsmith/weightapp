import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabaseServer';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/home',
  '/competitions',
  '/profile',
  '/admin',
  '/settings',
];

// Routes that should redirect authenticated users away
const AUTH_ROUTES = [
  '/signin',
  '/signup'
];

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/signin',
  '/signup',
  '/api'
];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Allow API routes, static files, and favicon
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.includes('favicon.ico') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  const { supabase, response } = createMiddlewareClient(request);
  
  // SECURITY: Use getUser() instead of getSession() to verify with server
  // This ensures the user data is authentic and not tampered with
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user && !error;
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    url.pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) =>
    url.pathname.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to signin
  if (isProtectedRoute && !isAuthenticated) {
    const redirectUrl = new URL('/signin', request.url);
    redirectUrl.searchParams.set('redirectTo', url.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth routes to home
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
