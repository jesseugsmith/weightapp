'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const { signUp, signInWithOAuth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setIsValidToken(true); // Allow open registration for now
      setIsLoading(false);
      return;
    }

    const validateToken = async () => {
      try {
        // Check if token exists in competition_invite_codes or similar
        const { data: inviteCode, error } = await supabase
          .from('competition_invite_codes')
          .select('*')
          .eq('code', token)
          .single();
        
        setIsValidToken(!!inviteCode && !error);
      } catch (error) {
        console.error('Token validation error:', error);
        setError('Invalid or expired signup link');
      }
      setIsLoading(false);
    };

    validateToken();
  }, [token]);

  const handleGoogleSignUp = async () => {
    try {
      setIsProcessing(true);
      setError('');
      const result = await signInWithOAuth('google');
      if (result.error) {
        setError(result.error);
      } else {
        // TODO: Record token usage if applicable
        router.push('/home');
      }
    } catch (error) {
      console.error('Google signup error:', error);
      setError('Failed to sign up with Google. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (token && !isValidToken) {
      setError('Invalid signup link');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');
      setSuccess('');
      
      const result = await signUp(email, password, firstName, lastName);
      
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess('Account created successfully! Please check your email to verify your account.');
        // TODO: Record token usage if applicable
        // For now, redirect to sign in
        setTimeout(() => {
          router.push('/signin');
        }, 2000);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError('Failed to sign up. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-primary py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-dark-primary">
            Create your account
          </h2>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Checking invitation..." />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div>
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isProcessing}
                className={`group relative w-full flex justify-center py-2 px-4 border border-gray-700 rounded-md text-sm font-medium ${
                  isProcessing
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'text-dark-primary bg-dark-secondary hover:bg-dark-hover'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </span>
                {isProcessing ? 'Signing up...' : 'Continue with Google'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-dark-primary text-gray-400">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailSignUp}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <input
                    id="first-name"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    disabled={isProcessing}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-dark-secondary placeholder-gray-400 text-dark-primary rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    id="last-name"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    disabled={isProcessing}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-dark-secondary placeholder-gray-400 text-dark-primary focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isProcessing}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-dark-secondary placeholder-gray-400 text-dark-primary focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    disabled={isProcessing}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 bg-dark-secondary placeholder-gray-400 text-dark-primary rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                    placeholder="Password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white 
                    ${isProcessing
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                  {isProcessing ? 'Creating account...' : 'Sign up with email'}
                </button>
              </div>
            </form>

            <div className="text-center">
              <Link href="/signin" className="text-indigo-500 hover:text-indigo-400">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
