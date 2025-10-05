import { NextRequest, NextResponse } from 'next/server';

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

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Check if user has auth token (PocketBase stores it in localStorage, 
  // but for SSR we'd need to check cookies or implement server-side session)
  // For now, we'll do basic path-based routing
  
  // Allow API routes, static files, and favicon
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.includes('favicon.ico') ||
    url.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // For protected routes, we'll let the client-side auth handle redirects
  // since PocketBase auth is primarily client-side
  return NextResponse.next();
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
