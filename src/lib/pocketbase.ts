import PocketBase, { RecordModel } from 'pocketbase';
import { User, Profile, WeightEntry, Competition } from '@/types/database.types';

// Initialize PocketBase client
export const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090');

// Disable auto-cancellation for better error handling
pb.autoCancellation(false);

// Helper function to retry operations that might fail due to cancellation
export async function pbRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // If it's the last attempt or not a cancellation error, throw
      if (attempt === maxRetries || !error?.isAbort) {
        throw error;
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 100 * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}


// Auth helpers
export const authHelpers = {
  // Sign up with email/password
  async signUp(email: string, password: string, name: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const userData = {
        email,
        password,
        passwordConfirm: password,
        name,
      };

      const record = await pb.collection('users').create(userData) as User;
      
      // Auto-create profile for the new user
      try {
        await pb.collection('profiles').create({
          user_id: record.id,
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
        });
      } catch (profileError) {
        console.warn('Failed to create profile during signup:', profileError);
        // Don't fail the signup if profile creation fails
      }
      
      // Send verification email
      await pb.collection('users').requestVerification(email);
      
      return { user: record, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign in with email/password
  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      return { user: authData.record as User, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },

  // Sign out
  signOut() {
    pb.authStore.clear();
  },

  // Get current user
  getCurrentUser(): User | null {
    return pb.authStore.model as User | null;
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return pb.authStore.isValid;
  },

  // Request password reset
  async requestPasswordReset(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      await pb.collection('users').requestPasswordReset(email);
      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // OAuth sign in (Google, GitHub, etc.)
  async signInWithOAuth(provider: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const authData = await pb.collection('users').authWithOAuth2({ provider });
      return { user: authData.record as User, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  },
};

// Data helpers
export const dataHelpers = {
  // Profile management
  async getProfile(userId: string) {
    return pb.collection('profiles').getFirstListItem(`user_id = "${userId}"`);
  },

  async createProfile(data: Omit<Profile, 'id' | 'created' | 'updated'>) {
    return pb.collection('profiles').create(data);
  },

  async updateProfile(profileId: string, data: Partial<Profile>) {
    return pb.collection('profiles').update(profileId, data);
  },

  // Weight entries
  async createWeightEntry(data: Omit<WeightEntry, 'id' | 'created' | 'updated'>) {
    return pb.collection('weight_entries').create(data);
  },

  async getWeightEntries(userId: string) {
    return pb.collection('weight_entries').getFullList({
      filter: `user_id = "${userId}"`,
      sort: '-date',
    });
  },

  // Competitions
  async createCompetition(data: Omit<Competition, 'id' | 'created' | 'updated'>) {
    return pb.collection('competitions').create(data);
  },

  async getCompetitions() {
    return pb.collection('competitions').getFullList({
      sort: '-created',
    });
  },

  async joinCompetition(competitionId: string, userId: string) {
    return pb.collection('competition_participants').create({
      competition_id: competitionId,
      user_id: userId,
      joined_at: new Date().toISOString(),
      is_active: true,
    });
  },
};

export default pb;
