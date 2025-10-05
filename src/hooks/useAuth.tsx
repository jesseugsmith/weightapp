'use client';

import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { pb } from '@/lib/pocketbase';
import {User} from '@/types/database.types';
import { usePocketBase } from './usePocketBase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ user: User | null; error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: string | null }>;
  signOut: () => void;
  signInWithOAuth: (provider: string) => Promise<{ user: User | null; error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    signInWithOAuth,
    requestPasswordReset,
  } = usePocketBase();

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
