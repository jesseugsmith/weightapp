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
import EditCompetitionModal from '@/components/EditCompetitionModal';

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

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

        // Fetch participant count
        const participants = await pb.collection('competition_participants').getFullList({
          filter: `competition_id = "${params.id}"`
        });
        setParticipantCount(participants.length);

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

  const handleCompetitionUpdated = async () => {
    // Refresh the competition data
    setLoading(true);
    setError(null);
    
    try {
      const competitionData = await pb.collection('competitions').getOne(params.id as string);
      setCompetition(competitionData as Competition);

      const prizesData = await pb.collection('prizes').getFullList({
        filter: `competition_id = "${params.id}"`,
        sort: 'rank'
      });
      setPrizes(prizesData as Prize[]);

      // Refresh participant count
      const participants = await pb.collection('competition_participants').getFullList({
        filter: `competition_id = "${params.id}"`
      });
      setParticipantCount(participants.length);

      setSuccess('Competition updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error refreshing competition details:', err);
      setError('Failed to refresh competition data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading competition details..." />;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!competition) return <div>Competition not found</div>;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Section */}
      <div className="mb-6 max-w-7xl mx-auto">
        <div className="bg-card border border-border rounded-lg shadow-sm p-5">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground">
                  {competition.name}
                </h1>
                <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                  competition.status === 'completed' 
                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                    : competition.status === 'started'
                    ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {competition.status.charAt(0).toUpperCase() + competition.status.slice(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{competition.description}</p>
              
              {/* Competition Info Grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Competition Period</p>
                    <p className="text-foreground font-medium text-sm">
                      {new Date(competition.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(competition.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Competition Type</p>
                    <p className="text-foreground font-medium text-sm capitalize">
                      {competition.competition_type?.replace(/_/g, ' ') || 'Weight Loss'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Total Prize Pool</p>
                    <p className="text-foreground font-medium text-sm">
                      ${competition.entry_fee && participantCount ? (competition.entry_fee * participantCount).toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {(isAdmin || (user && competition.created_by === user.id)) && (
              <div className="flex flex-col gap-2 lg:min-w-[180px]">
                {user && competition.created_by === user.id && competition.status !== 'completed' && (
                  <>
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit Competition
                    </button>
                    {competition.status === 'draft' && (
                      <button
                        onClick={handleStartCompetition}
                        disabled={startingCompetition}
                        className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md ${
                          startingCompetition 
                            ? 'bg-green-500/50 text-white cursor-not-allowed' 
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {startingCompetition ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
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
                  </>
                )}
                
                {isAdmin && (
                  <button
                    onClick={handleSendDetails}
                    disabled={sending}
                    className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md ${
                      sending 
                        ? 'bg-primary/50 text-primary-foreground cursor-not-allowed' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
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
            <div className="mt-4 rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <div className="text-xs text-destructive font-medium">{error}</div>
            </div>
          )}
          
          {success && (
            <div className="mt-4 rounded-md bg-green-500/10 border border-green-500/20 p-3">
              <div className="text-xs text-green-600 font-medium">{success}</div>
            </div>
          )}
        </div>
      </div>

      {/* Prizes Section */}
      {prizes.length > 0 && (
        <div className="mb-6 max-w-7xl mx-auto">
          <h2 className="text-xl font-bold text-foreground mb-3">Prizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {prizes.map((prize) => (
              <div 
                key={prize.id} 
                className="bg-card border border-border rounded-lg shadow-sm p-4"
              >
                <div className="text-center">
                  <div className="text-base font-semibold text-muted-foreground mb-1">
                    {prize.rank === 1 ? '🥇 1st' : prize.rank === 2 ? '🥈 2nd' : prize.rank === 3 ? '🥉 3rd' : `${prize.rank}th`} Place
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-2">
                    {prize.prize_amount ? `${prize.prize_amount}%` : 'TBD'}
                  </div>
                  {prize.prize_description && (
                    <p className="text-xs text-muted-foreground">{prize.prize_description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="mb-6 w-full">
        <h2 className="text-xl font-bold text-foreground mb-3 max-w-7xl mx-auto">Current Standings</h2>
        <LeaderboardCard 
          competitionId={competition.id}
          isEnded={competition.status === 'completed'}
        />
      </div>

      {/* Edit Competition Modal */}
      {competition && (
        <EditCompetitionModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          competition={competition}
          onCompetitionUpdated={handleCompetitionUpdated}
        />
      )}
    </div>
  );
}
