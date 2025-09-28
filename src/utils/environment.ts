// Get the base URL for the application
export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // Fallback for server-side
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}
