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
        if (session) {
          setSession(session);
          setUser(session.user);
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Ensure profile exists when user logs in (including OAuth)
      if (session?.user) {
        await ensureProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

    const ensureProfile = async (userId: string) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // If no profile exists, create one
      if (!existingProfile) {
        console.log('Creating new profile for user:', userId);
        const { error: createError } = await supabase
          .from('profiles')
          .insert([{ 
            id: crypto.randomUUID(),
            user_id: userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (createError) {
          console.error('Error creating profile:', createError);
          throw createError;
        }
      }
    } catch (error) {
      console.error('Error ensuring profile exists:', error);
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
    if (isGoogle) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      return { data: null, error }; // OAuth redirects, so we don't get user data here
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (data?.user) {
        await ensureProfile(data.user.id);
      }
      return { data: data ? { user: data.user } : null, error };
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
