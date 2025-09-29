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
    <div className="bg-opacity-10 backdrop-blur-lg shadow-lg rounded-lg p-6 border border-[var(--accent)] game-glow">
      <h3 className="text-2xl font-bold text-[var(--accent)] mb-6 game-float">Battle Rankings</h3>
      <div className="space-y-4">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className="flex items-center justify-between p-4 bg-opacity-20 backdrop-blur-md rounded-lg border border-gray-800 hover:border-[var(--accent)] transition-all duration-300"
          >
            <div className="flex items-center space-x-4">
              <span className={`text-xl font-bold ${
                index === 0 ? 'text-yellow-400' : 
                index === 1 ? 'text-gray-300' :
                index === 2 ? 'text-amber-600' :
                'text-gray-500'
              } game-float`}>
                {index === 0 ? '👑' : ''} #{index + 1}
              </span>
              <div>
                <p className="font-bold text-[var(--accent)]">{entry.user_email}</p>
                <p className="text-sm mt-1">
                  <span className={`font-medium ${
                    entry.starting_weight > entry.current_weight
                      ? 'text-[var(--success)]'
                      : entry.starting_weight < entry.current_weight
                      ? 'text-[var(--error)]'
                      : 'text-gray-500'
                  }`}>
                    {entry.starting_weight && !isNaN(entry.starting_weight) && 
                     entry.current_weight && !isNaN(entry.current_weight)
                      ? `${Math.abs(entry.starting_weight - entry.current_weight).toFixed(1)} lbs ${
                        entry.starting_weight > entry.current_weight ? '💪 Progress' : '⚠️ Setback'
                      }`
                      : '0 lbs'}
                  </span>
                  <span className="ml-2 text-gray-400">
                    🎯 Current Level: {entry.current_weight ? `${entry.current_weight.toFixed(1)}lbs` : 'Not logged'}
                  </span>
                </p>
              </div>
            </div>
            {isEnded && entry.prize_amount && (
              <div className="text-right">
                <p className="text-[var(--success)] font-bold text-lg game-float">
                  🏆 ${entry.prize_amount}
                </p>
                {entry.prize_description && (
                  <p className="text-sm text-[var(--accent)]">{entry.prize_description}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
