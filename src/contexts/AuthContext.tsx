'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, isGoogle?: boolean) => Promise<{ data: { user: User | null } | null, error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session);
        if (session) {
          setSession(session);
          setUser(session.user);
          await ensureProfile(session.user.id);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session);
      setSession(session);
      setUser(session?.user ?? null);
      
      // Ensure profile exists when user logs in (including OAuth)
      if (session?.user) {
        await ensureProfile(session.user.id);
      }

      // Handle initial sign in
      if (event === 'SIGNED_IN') {
        console.log('User signed in:', session?.user);
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Error refreshing session:', refreshError);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

    const ensureProfile = async (userId: string) => {
    const maxRetries = 3;
    let retryCount = 0;
    
    const checkProfile = async (): Promise<boolean> => {
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error checking profile:', error);
        return false;
      }

      return !!existingProfile;
    };

    // Initial check
    let hasProfile = await checkProfile();
    
    // If no profile exists, wait and retry a few times
    while (!hasProfile && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      hasProfile = await checkProfile();
      retryCount++;
    }

    // If still no profile after retries, try to create one manually
    if (!hasProfile) {
      try {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ user_id: userId }])
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
        }
      } catch (error) {
        console.error('Error creating profile:', error);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await ensureProfile(data.user.id);
    }
  };

  const signUp = async (email: string, password: string, isGoogle?: boolean) => {
    try {
      if (isGoogle) {
        // First check if we're returning from a Google OAuth flow with an error
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');
        const errorDescription = params.get('error_description');
        
        if (error) {
          throw new Error(errorDescription || error);
        }

        // Proceed with Google sign in
        const { data, error: signInError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: {
              prompt: 'select_account',
              access_type: 'offline'
            },
            skipBrowserRedirect: false
          }
        });

        // Wait for auth state to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (signInError) throw signInError;
        
        // Check if we got a session immediately
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session.user);
          if (session.user) {
            await ensureProfile(session.user.id);
          }
        }

        return { data: data || null, error: null };
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data?.user) {
          // Wait a moment for the trigger to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          await ensureProfile(data.user.id);
        }
        return { data: data ? { user: data.user } : null, error: null };
      }
    } catch (error) {
      console.error('Error during sign up:', error);
      return { data: null, error: error as Error };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
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
