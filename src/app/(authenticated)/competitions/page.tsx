'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

import type { Competition, CompetitionParticipant, Profile } from '@/types/supabase.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import CreateCompetitionModal from '@/components/CreateCompetitionModal';
import InviteMembersModal from '@/components/InviteMembersModal';
import JoinCompetitionsModal from '@/components/JoinCompetitionsModal';
import LeaderboardCard from '@/components/LeaderboardCard';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Button } from '@/components/ui/button';

interface ParticipantWithProfile {
  profile: Profile;
  avatarUrl: string | null;
}

interface CompetitionWithCreator extends Competition {
  creator?: Profile;
}

interface ParticipantWithCompetition extends CompetitionParticipant {
  competition?: CompetitionWithCreator;
}

export default function Competitions() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const supabase = createBrowserClient();
  const [competitions, setCompetitions] = useState<CompetitionWithCreator[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<ParticipantWithCompetition[]>([]);
  const [competitionParticipants, setCompetitionParticipants] = useState<Record<string, ParticipantWithProfile[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionWithCreator | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCompetitions();
      fetchMyCompetitions();
    }
  }, [user]);

  const fetchCompetitions = async () => {
    try {
      // First get competitions
      const { data: competitionsData, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'started')
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      if (compError) throw compError;

      // Then get creator profiles for each competition
      if (competitionsData && competitionsData.length > 0) {
        const creatorIds = [...new Set(competitionsData.map(c => c.created_by).filter(Boolean))];
        
        if (creatorIds.length > 0) {
          const { data: creatorsData, error: creatorsError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', creatorIds);

          if (creatorsError) {
            console.error('Error fetching creators:', creatorsError);
            // Continue without creator data
            setCompetitions(competitionsData.map(comp => ({ ...comp, creator: undefined })));
          } else {
            // Map creators to competitions (using id instead of user_id)
            const creatorsMap = new Map(creatorsData?.map(p => [p.id, p]) || []);
            const competitionsWithCreator = competitionsData.map(comp => ({
              ...comp,
              creator: creatorsMap.get(comp.created_by)
            }));

            setCompetitions(competitionsWithCreator);
          }
        } else {
          setCompetitions(competitionsData.map(comp => ({ ...comp, creator: undefined })));
        }
      } else {
        setCompetitions([]);
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  };

  const fetchMyCompetitions = async () => {
    if (!user?.id) return;
    
    try {
      // First get competition participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('competition_participants')
        .select('*, competitions(*)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (participantsError) throw participantsError;

      // Then get creator profiles for each competition
      if (participantsData && participantsData.length > 0) {
        const competitionsWithData = participantsData.filter(p => (p as any).competitions);
        const creatorIds = [...new Set(
          competitionsWithData
            .map(p => (p as any).competitions?.created_by)
            .filter(Boolean)
        )];
        
        if (creatorIds.length > 0) {
          const { data: creatorsData, error: creatorsError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', creatorIds);

          if (creatorsError) throw creatorsError;

          // Map creators to competitions (using id instead of user_id)
          const creatorsMap = new Map(creatorsData?.map(p => [p.id, p]) || []);
          
          const participantsWithCompetition = participantsData.map(item => ({
            ...item,
            competition: (item as any).competitions ? {
              ...(item as any).competitions,
              creator: creatorsMap.get((item as any).competitions.created_by)
            } : undefined
          }));

          // Filter out participants without competitions and sort by status
          const statusOrder: Record<string, number> = {
            'started': 0,
            'draft': 1,
            'completed': 2,
            'cancelled': 3
          };

          const sortedCompetitions = participantsWithCompetition
            .filter((item) => item.competition)
            .sort((a, b) => {
              const statusA = a.competition?.status || 'completed';
              const statusB = b.competition?.status || 'completed';
              return (statusOrder[statusA] || 999) - (statusOrder[statusB] || 999);
            });

          setMyCompetitions(sortedCompetitions);
          
          // Fetch participants for each competition
          await fetchCompetitionParticipants(sortedCompetitions);
        } else {
          setMyCompetitions([]);
          setLoading(false);
        }
      } else {
        setMyCompetitions([]);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching my competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionParticipants = async (competitions: ParticipantWithCompetition[]) => {
    try {
      const participantsMap: Record<string, ParticipantWithProfile[]> = {};
      
      for (const participation of competitions) {
        const competitionId = participation.competition?.id;
        if (!competitionId) continue;
        
        const { data: participants, error } = await supabase
          .from('competition_participants')
          .select(`
            *,
            profiles(*)
          `)
          .eq('competition_id', competitionId)
          .limit(10); // Limit to first 10 participants for display

        if (error) {
          console.error(`Error fetching participants for competition ${competitionId}:`, error);
          continue;
        }
        
        const participantsWithAvatars: ParticipantWithProfile[] = (participants || [])
          .filter((p: any) => p.profiles)
          .map((p: any) => {
            const profile = p.profiles as Profile;
            // Avatar is a URL string in Supabase Storage
            const avatarUrl = profile.avatar || null;
            
            return {
              profile,
              avatarUrl
            };
          });
        
        participantsMap[competitionId] = participantsWithAvatars;
      }
      
      setCompetitionParticipants(participantsMap);
    } catch (error) {
      console.error('Error fetching competition participants:', error);
    }
  };


  const handleJoinCompetition = async (competitionId: string) => {
    if (!user?.id) return;

    try {
      // First get the user's current weight
      const { data: weightRecords, error: weightError } = await supabase
        .from('weight_entries')
        .select('weight')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (weightError) throw weightError;
      
      const startingWeight = weightRecords?.[0]?.weight || null;
      
      // Insert the participant with their starting weight
      const { error: insertError } = await supabase
        .from('competition_participants')
        .insert({
          competition_id: competitionId,
          user_id: user.id,
          starting_weight: startingWeight,
          current_weight: startingWeight,
          joined_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      fetchMyCompetitions();
    } catch (error) {
      console.error('Error joining competition:', error);
    }
  };

  const handleDeleteCompetition = async (competitionId: string) => {
    if (!user?.id) return;

    try {
      // Supabase will cascade delete participants via ON DELETE CASCADE
      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', competitionId);

      if (error) throw error;

      // Refresh the competitions list
      fetchMyCompetitions();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting competition:', error);
      alert('Failed to delete competition. Please try again.');
    }
  };

  const canDeleteCompetition = (competition: CompetitionWithCreator) => {
    return competition.created_by === user?.id || hasPermission('manage_competitions');
  };

  const calculateDaysLeft = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const formatDaysLeft = (days: number) => {
    if (days < 0) {
      return 'Ended';
    } else if (days === 0) {
      return 'Ends today';
    } else if (days === 1) {
      return '1 day left';
    } else {
      return `${days} days left`;
    }
  };

  const renderParticipantAvatars = (competitionId: string) => {
    const participants = competitionParticipants[competitionId] || [];
    const maxDisplay = 5;
    const displayParticipants = participants.slice(0, maxDisplay);
    const remaining = participants.length - maxDisplay;
    
    if (participants.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {displayParticipants.map((participant, index) => {
            const displayName = [participant.profile.first_name, participant.profile.last_name]
              .filter(Boolean)
              .join(' ') || 'User';
            const initials = (participant.profile.first_name?.[0] || '') + 
                            (participant.profile.last_name?.[0] || '');
            
            return (
              <div
                key={participant.profile.id}
                className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden"
                style={{ zIndex: maxDisplay - index }}
                title={displayName}
              >
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-indigo-600 text-white text-xs font-medium">
                    {(initials || '?').toUpperCase()}
                  </div>
                )}
              </div>
            );
          })}
          {remaining > 0 && (
            <div
              className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600"
              style={{ zIndex: 0 }}
            >
              +{remaining}
            </div>
          )}
        </div>
        <span className="ml-3 text-sm text-gray-500">
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
        </span>
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner message="Loading competitions..." />;
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-foreground">Competitions</h1>
        <div className="flex space-x-4">
          <Button
            onClick={() => setIsJoinModalOpen(true)}
            variant="outline"
          >
            Join Competition
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
          >
            Create Competition
          </Button>
        </div>
      </div>
      <div>
        {myCompetitions.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg shadow">
            <p className="text-muted-foreground mb-4">You haven&apos;t joined any competitions yet</p>
            <Button
              onClick={() => setIsJoinModalOpen(true)}
            >
              Browse Competitions
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCompetitions.map((participation) => {
              const competition = participation.competition;
              if (!competition) return null;
              
              return (
                <div
                  key={participation.id}
                  className="bg-card rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer border border-border"
                  onClick={() => router.push(`/competitions/${competition.id}`)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-medium text-card-foreground flex-grow">
                        {competition.name}
                      </h3>
                      <div className="flex items-center space-x-2 ml-2">
                        {competition.status && (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            competition.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : competition.status === 'started'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {competition.status.charAt(0).toUpperCase() + 
                             competition.status.slice(1)}
                          </span>
                        )}
                        {canDeleteCompetition(competition) && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(competition.id);
                            }}
                            variant="ghost"
                            size="sm"
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete competition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {competition.description || 'No description provided'}
                    </p>
                    
                    {/* Participant avatars */}
                    <div className="mb-4">
                      {renderParticipantAvatars(competition.id)}
                    </div>
                    
                    <div className="flex items-center text-xs text-gray-400 mb-4">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {competition.end_date &&
                        (() => {
                          const daysLeft = calculateDaysLeft(competition.end_date);
                          const formattedDays = formatDaysLeft(daysLeft);
                          return (
                            <span className={
                              daysLeft < 0 ? 'text-red-500' : 
                              daysLeft <= 7 ? 'text-orange-500' : 
                              'text-gray-400'
                            }>
                              {formattedDays}
                            </span>
                          );
                        })()
                      }
                    </div>

                    <div className="flex justify-between items-center">
                      {competition.status === 'draft' && (
                        <div className="flex space-x-2">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCompetition(competition);
                              setIsInviteModalOpen(true);
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                          >
                            Invite Members
                          </Button>
                        </div>
                      )}
                    </div>
                    {competition.status === 'started' && (
                      <LeaderboardCard 
                        competitionId={competition.id} 
                        isEnded={false}
                      />
                    )}
                    {competition.status === 'completed' && (
                      <LeaderboardCard 
                        competitionId={competition.id} 
                        isEnded={true}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <CreateCompetitionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={user?.id || ''}
        onCompetitionCreated={() => {
          fetchCompetitions();
          fetchMyCompetitions();
        }}
      />
      {selectedCompetition && (
        <InviteMembersModal
          isOpen={isInviteModalOpen}
          onClose={() => {
            setIsInviteModalOpen(false);
            setSelectedCompetition(null);
          }}
          competitionId={selectedCompetition.id}
          competitionName={selectedCompetition.name}
        />
      )}
      <JoinCompetitionsModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        userId={user?.id || ''}
        onJoinCompetition={handleJoinCompetition}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Competition</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete this competition? This action cannot be undone and will remove all participants and data.
              </p>
              <div className="flex justify-center space-x-3">
                <Button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteCompetition(deleteConfirmId)}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
