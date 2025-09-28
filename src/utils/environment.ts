// Get the base URL for the application
export function getBaseUrl() {
  // In the browser, use the current URL
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Vercel deployment URL (handles both production and preview deployments)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    // Production domains should use https
    const protocol = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? 'https' : 'http';
    return `${protocol}://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  
  // Development fallback
  return 'http://localhost:3000';
}
