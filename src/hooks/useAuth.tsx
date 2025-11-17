'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { authHelpers } from '@/lib/supabaseAuth';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: SupabaseUser | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ user: SupabaseUser | null; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ user: SupabaseUser | null; error: string | null }>;
  signOut: () => Promise<void>;
  signInWithOAuth: (provider: string) => Promise<{ user: SupabaseUser | null; error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user (authenticated from server)
    authHelpers.getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = authHelpers.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      // SECURITY: Don't trust session.user directly from storage
      // Always verify with getUser() which contacts the auth server
      if (session) {
        authHelpers.getCurrentUser().then((verifiedUser) => {
          setUser(verifiedUser);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    return await authHelpers.signUp(email, password, firstName, lastName);
  };

  const signIn = async (email: string, password: string) => {
    return await authHelpers.signIn(email, password);
  };

  const signOut = async () => {
    await authHelpers.signOut();
    setUser(null);
  };

  const signInWithOAuth = async (provider: string) => {
    return await authHelpers.signInWithOAuth(provider as any);
  };

  const requestPasswordReset = async (email: string) => {
    return await authHelpers.requestPasswordReset(email);
  };

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    requestPasswordReset,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Custom hook for protected routes
export function useRequireAuth() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login page
      window.location.href = '/signin';
    }
  }, [user, loading]);

  return { user, loading };
}
