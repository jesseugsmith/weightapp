'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { pb } from '@/lib/pocketbase';
import { Competition, Prize } from '@/types/database.types';
import { isAdmin as checkIsAdmin } from '@/utils/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
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
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="mb-8 max-w-7xl mx-auto">
        <div className="bg-card border border-border rounded-lg shadow-sm p-8">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-foreground mb-3">
                {competition.name}
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{competition.description}</p>
              
              {/* Competition Info Grid */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Competition Period</p>
                    <p className="text-foreground font-semibold">
                      {new Date(competition.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(competition.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Competition Type</p>
                    <p className="text-foreground font-semibold capitalize">
                      {competition.competition_type?.replace(/_/g, ' ') || 'Weight Loss'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Competition Status Badge */}
              <div className="mt-6">
                <span className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-semibold ${
                  competition.status === 'completed' 
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : competition.status === 'started'
                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {(isAdmin || (user && competition.created_by === user.id)) && (
              <div className="flex flex-col gap-3 lg:min-w-[200px]">
                {user && competition.created_by === user.id && competition.status === 'draft' && (
                  <button
                    onClick={handleStartCompetition}
                    disabled={startingCompetition}
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md ${
                      startingCompetition 
                        ? 'bg-green-500/50 text-white cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
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
                      'Start Competition'
                    )}
                  </button>
                )}
                
                {isAdmin && (
                  <button
                    onClick={handleSendDetails}
                    disabled={sending}
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md ${
                      sending 
                        ? 'bg-primary/50 text-primary-foreground cursor-not-allowed' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </>
                    ) : (
                      'Send Competition Update'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Alert Messages */}
          {error && (
            <div className="mt-6 rounded-md bg-destructive/10 border border-destructive/20 p-4">
              <div className="text-sm text-destructive font-medium">{error}</div>
            </div>
          )}
          
          {success && (
            <div className="mt-6 rounded-md bg-green-500/10 border border-green-500/20 p-4">
              <div className="text-sm text-green-600 font-medium">{success}</div>
            </div>
          )}
        </div>
      </div>

      {/* Prizes Section */}
      {prizes.length > 0 && (
        <div className="mb-8 max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-4">Prizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prizes.map((prize) => (
              <div 
                key={prize.id} 
                className="bg-card border border-border rounded-lg shadow-sm p-6"
              >
                <div className="text-center">
                  <div className="text-lg font-semibold text-muted-foreground mb-2">
                    {prize.rank === 1 ? '1st' : prize.rank === 2 ? '2nd' : prize.rank === 3 ? '3rd' : `${prize.rank}th`} Place
                  </div>
                  <div className="text-3xl font-bold text-foreground mb-3">
                    {prize.value ? `$${prize.value.toLocaleString()}` : 'TBD'}
                  </div>
                  {prize.description && (
                    <p className="text-sm text-muted-foreground">{prize.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-8 w-full">
        <h2 className="text-2xl font-bold text-foreground mb-4 max-w-7xl mx-auto">Current Standings</h2>
        <LeaderboardCard 
          competitionId={competition.id}
          isEnded={competition.status === 'completed'}
        />
      </div>
    </div>
  );
}
