import { NextRequest, NextResponse } from 'next/server';

/**
 * Previously this middleware forced everything to redirect to `/`.
 * That was causing authenticated pages (e.g., admin dashboard) to bounce back home.
 * Now we simply allow requests to continue. Keep the file for future auth guards if needed.
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
