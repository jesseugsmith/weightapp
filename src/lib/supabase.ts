import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in browser/client components
 * This client automatically handles session management via cookies
 */
export function createBrowserClient() {
  return createSupabaseBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Export a singleton instance for client-side use
export const supabase = createBrowserClient();
