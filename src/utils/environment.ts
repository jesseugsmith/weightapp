// Get the base URL for the application
export function getBaseUrl() {
  // Check for Vercel production environment
  if (process.env.VERCEL_ENV === 'production') {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Check for Vercel preview environment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Check for explicitly set base URL
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  // If we're in the browser, use the current URL
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Development fallback
  return 'http://localhost:3000';
}
