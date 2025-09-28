'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import LoadingSpinner from './LoadingSpinner';

interface LeaderboardEntry {
  user_id: string;
  user_email: string;
  weight_loss_percentage: number;
  current_weight: number;
  starting_weight: number;
  rank: number;
  prize_amount?: number;
  prize_description?: string;
}

interface LeaderboardCardProps {
  competitionId: string;
  isEnded: boolean;
}

export default function LeaderboardCard({ competitionId, isEnded }: LeaderboardCardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const query = supabase
          .rpc('get_competition_standings', { competition_id: competitionId })
          .order('weight_loss_percentage', { ascending: false });

        const { data, error: standingsError } = await query;

        if (standingsError) throw standingsError;
        
        console.log('Leaderboard data:', data);

        // If competition is ended, fetch winners and prizes
        if (isEnded) {
          const { data: winners, error: winnersError } = await supabase
            .from('competition_winners')
            .select(`
              *,
              prizes (
                prize_amount,
                prize_description
              )
            `)
            .eq('competition_id', competitionId);

          if (winnersError) throw winnersError;

          // Merge winner data with standings
          const leaderboardWithPrizes = data.map((entry: LeaderboardEntry) => {
            const winner = winners?.find(w => w.user_id === entry.user_id);
            if (winner) {
              return {
                ...entry,
                prize_amount: winner.prizes?.prize_amount,
                prize_description: winner.prizes?.prize_description
              };
            }
            return entry;
          });

          setLeaderboard(leaderboardWithPrizes);
        } else {
          setLeaderboard(data);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [competitionId, isEnded]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Leaderboard</h3>
      <div className="space-y-4">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center space-x-4">
              <span className={`text-lg font-semibold ${index < 3 ? 'text-yellow-500' : ''}`}>
                #{index + 1}
              </span>
              <div>
                <p className="font-medium">{entry.user_email}</p>
                <p className="text-sm">
                  <span className={
                    entry.starting_weight > entry.current_weight
                      ? 'text-green-600'
                      : entry.starting_weight < entry.current_weight
                      ? 'text-red-600'
                      : 'text-gray-500'
                  }>
                    {entry.starting_weight && !isNaN(entry.starting_weight) && 
                     entry.current_weight && !isNaN(entry.current_weight)
                      ? `${Math.abs(entry.starting_weight - entry.current_weight).toFixed(1)} lbs ${
                        entry.starting_weight > entry.current_weight ? 'lost' : 'gained'
                      }`
                      : '0 lbs'}
                  </span>
                  <span className="ml-2 text-gray-500">
                    (Current: {entry.current_weight ? `${entry.current_weight.toFixed(1)}lbs` : 'Not logged'})
                  </span>
                </p>
              </div>
            </div>
            {isEnded && entry.prize_amount && (
              <div className="text-right">
                <p className="text-green-600 font-semibold">${entry.prize_amount}</p>
                {entry.prize_description && (
                  <p className="text-sm text-gray-500">{entry.prize_description}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
