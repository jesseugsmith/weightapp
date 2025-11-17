import { NextRequest, NextResponse } from 'next/server';

// Only allow the landing page and API routes
const ALLOWED_ROUTES = ['/', '/api'];

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

  // Allow only the landing page
  if (url.pathname === '/') {
    return NextResponse.next();
  }

  // Redirect all other routes to the landing page
  return NextResponse.redirect(new URL('/', request.url));
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
