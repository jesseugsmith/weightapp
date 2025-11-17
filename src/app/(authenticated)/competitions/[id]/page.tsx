'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Competition, Prize } from '@/types/supabase.types';
import { usePermissions } from '@/contexts/PermissionsContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import LeaderboardCard from '@/components/LeaderboardCard';
import EditCompetitionModal from '@/components/EditCompetitionModal';
import CompetitionMessagingBoard from '@/components/CompetitionMessagingBoard';
import { MessageCircle, Trophy } from 'lucide-react';

export default function CompetitionDetails() {
  const params = useParams();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [startingCompetition, setStartingCompetition] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'chat'>('leaderboard');

  const isAdmin = hasPermission('manage_competitions');

  useEffect(() => {
    async function fetchCompetitionDetails() {
      try {
        const supabase = createBrowserClient();

        // Fetch competition details
        const { data: competitionData, error: compError } = await supabase
          .from('competitions')
          .select('*')
          .eq('id', params.id as string)
          .single();

        if (compError) throw compError;
        setCompetition(competitionData);

        // Fetch prizes for this competition
        const { data: prizesData, error: prizesError } = await supabase
          .from('prizes')
          .select('*')
          .eq('competition_id', params.id as string)
          .order('rank', { ascending: true });

        if (prizesError) throw prizesError;
        setPrizes(prizesData || []);

        // Fetch participant count
        const { data: participants, error: participantsError } = await supabase
          .from('competition_participants')
          .select('id')
          .eq('competition_id', params.id as string);

        if (participantsError) throw participantsError;
        setParticipantCount(participants?.length || 0);

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
  }, [params.id, hasPermission]);

  const handleStartCompetition = async () => {
    if (!competition || !user) return;
    
    setStartingCompetition(true);
    setError(null);
    setSuccess(null);
    
    try {
      const supabase = createBrowserClient();
      
      // Update competition status to 'started'
      const { error: updateError } = await supabase
        .from('competitions')
        .update({ status: 'started' })
        .eq('id', competition.id);

      if (updateError) throw updateError;

      setCompetition({ ...competition, status: 'started' });
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
      // TODO: Implement competition email functionality
      // This would require creating an API endpoint to send competition details via email
      // const response = await fetch('/api/send-competition-details', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ competition_id: competition.id }),
      // });
      
      setError('Competition email functionality not yet implemented');
      
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
      const supabase = createBrowserClient();

      const { data: competitionData, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', params.id as string)
        .single();

      if (compError) throw compError;
      setCompetition(competitionData);

      const { data: prizesData, error: prizesError } = await supabase
        .from('prizes')
        .select('*')
        .eq('competition_id', params.id as string)
        .order('rank', { ascending: true });

      if (prizesError) throw prizesError;
      setPrizes(prizesData || []);

      // Refresh participant count
      const { data: participants, error: participantsError } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', params.id as string);

      if (participantsError) throw participantsError;
      setParticipantCount(participants?.length || 0);

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
                      disabled={competition.status === 'started'}
                      className={`inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md ${
                        competition.status === 'started'
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      title={competition.status === 'started' ? 'Cannot edit active competitions' : 'Edit competition'}
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
        <div className="max-w-7xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'leaderboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'leaderboard' ? (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-3">Current Standings</h2>
              <LeaderboardCard 
                competitionId={competition.id}
                isEnded={competition.status === 'completed'}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm" style={{ height: '600px' }}>
              <CompetitionMessagingBoard
                competitionId={competition.id}
                competitionName={competition.name}
              />
            </div>
          )}
        </div>
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
