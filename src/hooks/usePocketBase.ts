/**
 * Extended PocketBase hook that provides comprehensive database and auth functionality
 * 
 * Features:
 * - Automatic profile creation for new users
 * - Auth state management with auto-login persistence
 * - Generic collection CRUD operations with retry logic
 * - Specialized methods for weight tracking and competitions
 * - Comprehensive error handling
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     user, profile, isAuthenticated,
 *     signIn, signOut, updateProfile,
 *     getWeightEntries, createWeightEntry
 *   } = usePocketBase();
 * 
 *   // Auth is handled automatically, profile is auto-created
 *   if (!isAuthenticated) return <LoginForm onSubmit={signIn} />;
 * 
 *   return (
 *     <div>
 *       <h1>Welcome {profile?.first_name}!</h1>
 *       <button onClick={() => updateProfile({ nickname: 'NewNick' })}>
 *         Update Profile
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { pb, pbRetry } from '@/lib/pocketbase';
import { RecordModel } from 'pocketbase';
import {User, Profile,WeightEntry,Competition} from "@/types/database.types";

interface UsePocketBaseReturn {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  
  // Auth methods
  signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  signOut: () => void;
  signInWithOAuth: (provider: string) => Promise<{ user: User | null; error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error: string | null }>;
  
  // Profile methods
  profile: Profile | null;
  profileLoading: boolean;
  profileError: Error | null;
  updateProfile: (data: Partial<Profile>) => Promise<Profile | null>;
  refreshProfile: () => Promise<void>;
  
  // Collection helpers
  create: <T extends RecordModel>(collection: string, data: any) => Promise<T>;
  getList: <T extends RecordModel>(collection: string, options?: any) => Promise<T[]>;
  getOne: <T extends RecordModel>(collection: string, id: string) => Promise<T>;
  update: <T extends RecordModel>(collection: string, id: string, data: any) => Promise<T>;
  delete: (collection: string, id: string) => Promise<boolean>;
  
  // Specialized methods
  getWeightEntries: (userId?: string) => Promise<WeightEntry[]>;
  createWeightEntry: (data: Omit<WeightEntry, 'id' | 'created' | 'updated'>) => Promise<WeightEntry>;
  getCompetitions: () => Promise<Competition[]>;
  joinCompetition: (competitionId: string) => Promise<boolean>;
}

export function usePocketBase(): UsePocketBaseReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<Error | null>(null);

  // Auto-create profile for user if it doesn't exist
  const ensureProfile = useCallback(async (currentUser: User): Promise<Profile | null> => {
    if (!currentUser) return null;

    try {
      setProfileLoading(true);
      setProfileError(null);

      // Try to get existing profile
      try {
        const existingProfile = await pbRetry(() =>
          pb.collection('profiles').getFirstListItem(`user_id = "${currentUser.id}"`)
        );
        return existingProfile as Profile;
      } catch (error: any) {
        // If profile doesn't exist (404), create one
        if (error?.status === 404) {
          console.log('Profile not found, creating new profile for user:', currentUser.id);
          
          const newProfile = await pbRetry(() =>
            pb.collection('profiles').create({
              user_id: currentUser.id,
              first_name: currentUser.name?.split(' ')[0] || '',
              last_name: currentUser.name?.split(' ').slice(1).join(' ') || '',
            })
          );

          console.log('New profile created:', newProfile);
          return newProfile as Profile;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error ensuring profile:', error);
      setProfileError(error as Error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Check if user is already authenticated
    const currentUser = pb.authStore.model as User | null;
    setUser(currentUser);
    
    // If user exists, ensure they have a profile
    if (currentUser) {
      ensureProfile(currentUser).then(setProfile);
    }
    
    setLoading(false);

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange(async (token, model) => {
      const newUser = model as User | null;
      setUser(newUser);
      
      if (newUser) {
        // Auto-create profile if user logs in and doesn't have one
        const userProfile = await ensureProfile(newUser);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
    });

    return unsubscribe;
  }, [ensureProfile]);

  // Auth methods with auto profile creation
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    try {
      const userData = {
        email,
        password,
        passwordConfirm: password,
        name,
      };

      const record = await pb.collection('users').create(userData) as User;
      
      // Auto-create profile for the new user
      const newProfile = await ensureProfile(record);
      setProfile(newProfile);
      
      // Send verification email
      try {
        await pb.collection('users').requestVerification(email);
      } catch (verifyError) {
        console.warn('Failed to send verification email:', verifyError);
      }
      
      return { user: record, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }, [ensureProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      const authUser = authData.record as User;
      
      // Ensure profile exists after sign in
      const userProfile = await ensureProfile(authUser);
      setProfile(userProfile);
      
      return { user: authUser, error: null };
    } catch (error: any) {
      return { user: null, error: error.message };
    }
  }, [ensureProfile]);

  const signOut = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setProfile(null);
  }, []);

  const signInWithOAuth = useCallback(async (provider: string) => {
    try {
      // Use the OAuth2 redirect flow as per PocketBase docs
      const authData = await pb.collection('users').authWithOAuth2({
        provider: provider
      });
      
      const authUser = authData.record as User;
      
      // Ensure profile exists after OAuth sign in
      const userProfile = await ensureProfile(authUser);
      setProfile(userProfile);
      
      return { user: authUser, error: null };
    } catch (error: any) {
      console.error('OAuth sign-in error:', error);
      return { user: null, error: error.message || 'Failed to sign in with OAuth' };
    }
  }, [ensureProfile]);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email);
      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, []);

  // Profile methods
  const updateProfile = useCallback(async (data: Partial<Profile>): Promise<Profile | null> => {
    if (!profile || !user) return null;

    try {
      const updatedProfile = await pbRetry(() =>
        pb.collection('profiles').update(profile.id, data)
      );
      setProfile(updatedProfile as Profile);
      
      // Update Novu subscriber if first_name or last_name changed
      if (data.first_name !== undefined || data.last_name !== undefined) {
        try {
          const { updateNovuSubscriber } = await import('./useNovuPush');
          await updateNovuSubscriber(
            user.id,
            user.email,
            updatedProfile.first_name,
            updatedProfile.last_name
          );
        } catch (novuError) {
          console.error('Failed to update Novu subscriber:', novuError);
          // Don't fail the profile update if Novu update fails
        }
      }
      
      return updatedProfile as Profile;
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileError(error as Error);
      return null;
    }
  }, [profile, user]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const freshProfile = await ensureProfile(user);
    setProfile(freshProfile);
  }, [user, ensureProfile]);

  // Generic collection helpers
  const create = useCallback(async <T extends RecordModel>(collection: string, data: any): Promise<T> => {
    return pbRetry(() => pb.collection(collection).create(data)) as Promise<T>;
  }, []);

  const getList = useCallback(async <T extends RecordModel>(collection: string, options: any = {}): Promise<T[]> => {
    const records = await pbRetry(() => pb.collection(collection).getFullList(options));
    return records as T[];
  }, []);

  const getOne = useCallback(async <T extends RecordModel>(collection: string, id: string): Promise<T> => {
    return pbRetry(() => pb.collection(collection).getOne(id)) as Promise<T>;
  }, []);

  const update = useCallback(async <T extends RecordModel>(collection: string, id: string, data: any): Promise<T> => {
    return pbRetry(() => pb.collection(collection).update(id, data)) as Promise<T>;
  }, []);

  const deleteRecord = useCallback(async (collection: string, id: string): Promise<boolean> => {
    try {
      await pbRetry(() => pb.collection(collection).delete(id));
      return true;
    } catch (error) {
      console.error('Error deleting record:', error);
      return false;
    }
  }, []);

  // Specialized methods
  const getWeightEntries = useCallback(async (userId?: string): Promise<WeightEntry[]> => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return [];

    return getList<WeightEntry>('weight_entries', {
      filter: `user_id = "${targetUserId}"`,
      sort: '-date',
    });
  }, [user?.id, getList]);

  const createWeightEntry = useCallback(async (data: Omit<WeightEntry, 'id' | 'created' | 'updated'>): Promise<WeightEntry> => {
    return create<WeightEntry>('weight_entries', data);
  }, [create]);

  const getCompetitions = useCallback(async (): Promise<Competition[]> => {
    return getList<Competition>('competitions', {
      sort: '-created',
    });
  }, [getList]);

  const joinCompetition = useCallback(async (competitionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      await create('competition_participants', {
        competition_id: competitionId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
        is_active: true,
      });
      return true;
    } catch (error) {
      console.error('Error joining competition:', error);
      return false;
    }
  }, [user, create]);

  return {
    // Auth state
    user,
    isAuthenticated: !!user,
    loading,
    
    // Auth methods
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    requestPasswordReset,
    
    // Profile methods
    profile,
    profileLoading,
    profileError,
    updateProfile,
    refreshProfile,
    
    // Collection helpers
    create,
    getList,
    getOne,
    update,
    delete: deleteRecord,
    
    // Specialized methods
    getWeightEntries,
    createWeightEntry,
    getCompetitions,
    joinCompetition,
  };
}
