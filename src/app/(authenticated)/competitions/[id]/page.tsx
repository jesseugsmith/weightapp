'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { Competition, Prize } from '@/types/database.types';
import { isAdmin as checkIsAdmin } from '@/utils/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import LeaderboardCard from '@/components/LeaderboardCard';
import { competitionService} from '@/utils/dataService';

export default function CompetitionDetails() {
  const params = useParams();
  const { user } = useAuth();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingCompetition, setStartingCompetition] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminStatus() {
      const adminStatus = await checkIsAdmin();
      setIsAdmin(adminStatus);
    }

    async function fetchCompetitionDetails() {
      try {
        // Fetch competition details
        const competitionData = await pb.collection('competitions').getOne(params.id as string);
        setCompetition(competitionData as Competition);

        // Fetch prizes for this competition
        const prizesData = await pb.collection('prizes').getFullList({
          filter: `competition_id = "${params.id}"`,
          sort: 'rank'
        });
        setPrizes(prizesData as Prize[]);

      } catch (err) {
        console.error('Error fetching competition details:', err);
        setError('Failed to load competition details');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      checkAdminStatus();
      fetchCompetitionDetails();
    }
  }, [params.id]);

  const handleStartCompetition = async () => {
    if (!competition || !user) return;
    
    setStartingCompetition(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update competition status to 'started'
      const comp = await competitionService.startCompetition(competition.id);
      if (!comp) {
        throw new Error('Failed to start competition');
      }
      //setCompetition(updatedCompetition as Competition);
      setSuccess('Competition started successfully! Participants can now begin logging their progress.');
      
    } catch (err) {
      console.error('Error starting competition:', err);
      setError(err instanceof Error ? err.message : 'Failed to start competition');
    } finally {
      setStartingCompetition(false);
    }
  };

  const handleSendDetails = async () => {
    if (!competition) return;
    
    setSending(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Note: This functionality would need to be reimplemented with PocketBase
      // Since PocketBase doesn't have edge functions like Supabase, you would need to:
      // 1. Create a separate API endpoint in your Next.js app
      // 2. Or use a service like Resend/SendGrid directly from the client
      // 3. Or implement this server-side functionality differently
      
      setError('Competition email functionality not yet implemented with PocketBase');
      
      // Placeholder for future implementation:
      // const response = await fetch('/api/send-competition-details', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ competition_id: competition.id }),
      // });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send competition details');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading competition details..." />;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!competition) return <div>Competition not found</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{competition.name}</h1>
            <p className="mt-2 text-lg text-gray-600">{competition.description}</p>
            
            <div className="mt-4 flex items-center text-sm text-gray-500">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(competition.start_date).toLocaleDateString()} - {new Date(competition.end_date).toLocaleDateString()}
            </div>
          </div>

          {(isAdmin || (user && competition.created_by === user.id)) && (
            <div className="flex space-x-3">
              {/* Start Competition Button - only show if user is owner and competition is draft */}
              {user && competition.created_by === user.id && competition.status === 'draft' && (
                <button
                  onClick={handleStartCompetition}
                  disabled={startingCompetition}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                    ${startingCompetition ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                >
                  {startingCompetition ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start Competition
                    </>
                  )}
                </button>
              )}
              
              {/* Send Details Button - only show for admins */}
              {isAdmin && (
                <button
                  onClick={handleSendDetails}
                  disabled={sending}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                    ${sending ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                  {sending ? 'Sending...' : 'Send Competition Update'}
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        
        {success && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

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
                <div className="text-2xl font-bold text-green-600 mb-2">
                  {prize.value ? `$${prize.value}` : 'Prize TBD'}
                </div>
                {prize.description && (
                  <p className="text-sm text-gray-500">{prize.description}</p>
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
