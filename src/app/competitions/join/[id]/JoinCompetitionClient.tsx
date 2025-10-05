'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { pb } from '@/lib/pocketbase';

import LoadingSpinner from '@/components/LoadingSpinner';

interface JoinCompetitionClientProps {
  id: string;
}

export default function JoinCompetitionClient({ id }: JoinCompetitionClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const joinCompetition = async () => {
      if (!user) {
        router.push(`/signin?redirect=/competitions/join/${id}?${searchParams.toString()}`);
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
        const invite = await pb.collection('competition_invites').getFirstListItem(
          `competition_id = "${id}" && email = "${email.toLowerCase()}" && status = "pending"`
        ).catch(() => null);

        if (!invite) {
          setError('Invalid or expired invite');
          setLoading(false);
          return;
        }

        // Get the user's current weight to use as starting weight
        const weightEntries = await pb.collection('weight_entries').getFullList({
          filter: `user_id = "${user.id}"`,
          sort: '-date',
          limit: 1
        });

        const startingWeight = weightEntries?.[0]?.weight;

        // Check if user already in competition
        const existing = await pb.collection('competition_participants').getFirstListItem(
          `competition_id = "${id}" && user_id = "${user.id}"`
        ).catch(() => null);

        if (existing) {
          setError('You are already a member of this competition');
          setLoading(false);
          return;
        }

        // Join the competition
        await pb.collection('competition_participants').create({
          competition_id: id,
          user_id: user.id,
          starting_weight: startingWeight,
          current_weight: startingWeight,
          joined_at: new Date().toISOString(),
          is_active: true
        });

        // Update invite status
        await pb.collection('competition_invites').update(invite.id, { status: 'accepted' });

        // Redirect to competitions page
        router.push('/competitions');
      } catch (error) {
        console.error('Error joining competition:', error);
        setError('An unexpected error occurred');
        setLoading(false);
      }
    };

    joinCompetition();
  }, [user, id, router, searchParams]);

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
