// Get the base URL for the application
export function getBaseUrl() {
  // In the browser, use the current URL
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Vercel deployment URL (handles both production and preview deployments)
  // VERCEL_URL is available during build time, so we check both runtime and build-time variables
  if (process.env.VERCEL_URL) {
    // Always use https for Vercel deployments
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Check for manually set site URL (fallback)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  
  // Development fallback
  return 'http://localhost:3000';
}
