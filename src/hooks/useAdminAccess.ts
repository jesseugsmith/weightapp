'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { createBrowserClient } from '@/lib/supabase';

interface UseAdminAccessReturn {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to check if the current user has admin access
 * Checks the `admin` table for user entry
 */
export function useAdminAccess(): UseAdminAccessReturn {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;

      if (!user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error: checkError } = await supabase
          .from('admin')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError) {
          console.error('Error checking admin status:', checkError);
          setError(checkError.message);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
          setError(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Exception checking admin status:', err);
        setError(errorMessage);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user?.id, authLoading, supabase]);

  return { isAdmin, loading, error };
}

/**
 * Hook to check if user has admin access and handle redirect
 */
export function useRequireAdminAccess(redirectTo: string = '/home') {
  const { isAdmin, loading, error } = useAdminAccess();
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!isAdmin) {
      // Redirect non-admins away from admin pages
      window.location.href = redirectTo;
    } else {
      setHasAccess(true);
    }
  }, [isAdmin, loading, redirectTo]);

  return { hasAccess, loading, error };
}
