'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function JoinCompetition({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const joinCompetition = async () => {
      if (!user) {
        router.push(`/signin?redirect=/competitions/join/${params.id}?${searchParams.toString()}`);
        return;
      }

      const email = searchParams.get('email');
      if (!email) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        // Verify the invite exists and is valid
        const { data: invite, error: inviteError } = await supabase
          .from('competition_invites')
          .select('*')
          .eq('competition_id', params.id)
          .eq('email', email.toLowerCase())
          .eq('status', 'pending')
          .single();

        if (inviteError || !invite) {
          setError('Invalid or expired invite');
          setLoading(false);
          return;
        }

        // Join the competition
        const { error: joinError } = await supabase
          .from('competition_participants')
          .insert([
            {
              competition_id: params.id,
              user_id: user.id,
            },
          ]);

        if (joinError) {
          if (joinError.code === '23505') {
            setError('You are already a member of this competition');
          } else {
            setError('Failed to join competition');
          }
          setLoading(false);
          return;
        }

        // Update invite status
        await supabase
          .from('competition_invites')
          .update({ status: 'accepted' })
          .eq('id', invite.id);

        // Redirect to competitions page
        router.push('/competitions');
      } catch (error) {
        console.error('Error joining competition:', error);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    joinCompetition();
  }, [user, params.id, router, searchParams]);

  if (loading) {
    return <LoadingSpinner message="Joining competition..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Error</h2>
            <p className="mt-2 text-sm text-red-600">{error}</p>
            <button
              onClick={() => router.push('/competitions')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Go to Competitions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
