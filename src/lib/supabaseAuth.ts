import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

/**
 * Auth helpers for Supabase - replaces PocketBase authHelpers
 * These functions handle user authentication and session management
 */
export const authHelpers = {
  /**
   * Sign up with email/password
   * Auto-creates a profile for the new user
   */
  async signUp(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      // Profile will be auto-created via database trigger
      // The trigger will use raw_user_meta_data->'first_name' and 'last_name'
      
      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  /**
   * Sign in with email/password
   */
  async signIn(
    email: string,
    password: string
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return { user: data.user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
  },

  /**
   * Get current user
   * Returns null if not authenticated
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Get current session
   * WARNING: This should only be used for getting access tokens, not user data
   * For user data, use getCurrentUser() instead which verifies with the server
   */
  async getSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Check if user is authenticated
   * SECURITY: Uses getUser() instead of getSession() to verify with server
   */
  async isAuthenticated(): Promise<boolean> {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return !!user && !error;
  },

  /**
   * Request password reset
   */
  async requestPasswordReset(
    email: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Update password (when user is already authenticated)
   */
  async updatePassword(
    newPassword: string
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  /**
   * OAuth sign in (Google, GitHub, etc.)
   * Supported providers: 'google', 'github', 'gitlab', 'azure', etc.
   */
  async signInWithOAuth(
    provider: 'google' | 'github' | 'gitlab' | 'azure' | 'apple' | 'discord'
  ): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { user: null, error: error.message };
      }

      // OAuth flow redirects, so we won't have user data immediately
      return { user: null, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  /**
   * Listen to auth state changes
   * Call this in your app layout or main component
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },
};

/**
 * Data helpers for Supabase - replaces PocketBase dataHelpers
 */
export const dataHelpers = {
  /**
   * Profile management
   */
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  async createProfile(data: {
    id: string; // Changed from user_id to id
    first_name?: string;
    last_name?: string;
    avatar?: string;
  }) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return profile;
  },

  async updateProfile(userId: string, data: Partial<any>) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return profile;
  },

  /**
   * Weight entries
   */
  async createWeightEntry(data: {
    user_id: string;
    weight: number;
    date: string;
    notes?: string;
  }) {
    const { data: entry, error } = await supabase
      .from('weight_entries')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return entry;
  },

  async getWeightEntries(userId: string) {
    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Competitions
   */
  async createCompetition(data: {
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    created_by: string;
  }) {
    const { data: competition, error } = await supabase
      .from('competitions')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return competition;
  },

  async getCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async joinCompetition(competitionId: string, userId: string) {
    const { data, error } = await supabase
      .from('competition_participants')
      .insert({
        competition_id: competitionId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export default supabase;
