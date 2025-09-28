'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Competition, Prize } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import LeaderboardCard from '@/components/LeaderboardCard';

export default function CompetitionDetails() {
  const params = useParams();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompetitionDetails() {
      try {
        // Fetch competition details
        const { data: competitionData, error: competitionError } = await supabase
          .from('competitions')
          .select('*')
          .eq('id', params.id)
          .single();

        if (competitionError) throw competitionError;
        setCompetition(competitionData);

        // Fetch prizes for this competition
        const { data: prizesData, error: prizesError } = await supabase
          .from('prizes')
          .select('*')
          .eq('competition_id', params.id)
          .order('rank', { ascending: true });

        if (prizesError) throw prizesError;
        setPrizes(prizesData || []);

      } catch (err) {
        console.error('Error fetching competition details:', err);
        setError('Failed to load competition details');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchCompetitionDetails();
    }
  }, [params.id]);

  if (loading) return <LoadingSpinner message="Loading competition details..." />;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!competition) return <div>Competition not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">{competition.name}</h1>
        <p className="mt-2 text-lg text-gray-600">{competition.description}</p>
        
        <div className="mt-4 flex items-center text-sm text-gray-500">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {new Date(competition.start_date).toLocaleDateString()} - {new Date(competition.end_date).toLocaleDateString()}
        </div>

        {/* Competition Status Badge */}
        <div className="mt-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            competition.status === 'completed' 
              ? 'bg-green-100 text-green-800'
              : competition.status === 'started'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Prizes Section */}
      {prizes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Prizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prizes.map((prize) => (
              <div key={prize.id} className="bg-white shadow rounded-lg p-6">
                <div className="text-lg font-medium text-gray-900 mb-2">
                  {prize.rank === 1 ? '🥇' : prize.rank === 2 ? '🥈' : prize.rank === 3 ? '🥉' : `#${prize.rank}`}
                  {' '}Place
                </div>
                <div className="text-2xl font-bold text-green-600 mb-2">${prize.prize_amount}</div>
                {prize.prize_description && (
                  <p className="text-sm text-gray-500">{prize.prize_description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Current Standings</h2>
        <LeaderboardCard 
          competitionId={competition.id}
          isEnded={competition.status === 'completed'}
        />
      </div>
    </div>
  );
}
