import { usePocketBase } from './usePocketBase';

export function useProfile() {
  const { profile, profileLoading: loading, profileError: error, updateProfile, refreshProfile } = usePocketBase();

  return { 
    profile, 
    loading, 
    error, 
    updateProfile, 
    refreshProfile 
  };
}
