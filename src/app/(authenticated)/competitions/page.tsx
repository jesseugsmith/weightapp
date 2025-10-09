'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { competitionService } from '@/utils/dataService';

import { Competition, CompetitionParticipant, User } from '../../../types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import CreateCompetitionModal from '@/components/CreateCompetitionModal';
import InviteMembersModal from '@/components/InviteMembersModal';
import JoinCompetitionsModal from '@/components/JoinCompetitionsModal';
import LeaderboardCard from '@/components/LeaderboardCard';
import { usePermissions } from '@/contexts/PermissionContext';
import { Button } from '@/components/ui/button';

interface ParticipantWithUser {
  user: User;
  avatarUrl: string | null;
}

export default function Competitions() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<CompetitionParticipant[]>([]);
  const [competitionParticipants, setCompetitionParticipants] = useState<Record<string, ParticipantWithUser[]>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCompetitions();
      fetchMyCompetitions();
    }
  }, [user]);

  const fetchCompetitions = async () => {
    try {
      const result = await pb.collection('competitions').getFullList({
        filter: `status = "active" && end_date >= "${new Date().toISOString()}"`,
        sort: 'start_date',
        expand: 'created_by'
      });
      setCompetitions(result as Competition[]);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  };

  const fetchMyCompetitions = async () => {
    try {
      const result = await pb.collection('competition_participants').getFullList({
        filter: `user_id = "${user?.id}"`,
        expand: 'competition_id',
        sort: '-joined_at'
      });
      
      // Filter out null competitions and sort by status
      const statusOrder: Record<string, number> = {
        'active': 0,
        'upcoming': 1,
        'completed': 2
      };

      const sortedCompetitions = result
        .filter((item: any) => item.expand?.competition_id)
        .sort((a: any, b: any) => {
          // Custom sort order: active -> upcoming -> completed
          const statusA = a.expand?.competition_id?.status || 'completed';
          const statusB = b.expand?.competition_id?.status || 'completed';
          return (statusOrder[statusA] || 999) - (statusOrder[statusB] || 999);
        });

      setMyCompetitions(sortedCompetitions as CompetitionParticipant[]);
      
      // Fetch participants for each competition
      await fetchCompetitionParticipants(sortedCompetitions as CompetitionParticipant[]);
    } catch (error) {
      console.error('Error fetching my competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompetitionParticipants = async (competitions: CompetitionParticipant[]) => {
    try {
      const participantsMap: Record<string, ParticipantWithUser[]> = {};
      
      for (const competition of competitions) {
        const competitionId = competition.expand?.competition_id?.id;
        if (!competitionId) continue;
        
        const participants = await pb.collection('competition_participants').getFullList({
          filter: `competition_id = "${competitionId}"`,
          expand: 'user_id',
          limit: 10 // Limit to first 10 participants for display
        });
        
        const participantsWithAvatars: ParticipantWithUser[] = participants
          .filter((p: any) => p.expand?.user_id)
          .map((p: any) => {
            const user = p.expand.user_id as User;
            let avatarUrl = null;
            
            // Try to get avatar from user
            if (user.avatar) {
              avatarUrl = pb.files.getUrl(user, user.avatar, { thumb: '100x100' });
            }
            
            return {
              user,
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
    if (!user) return;

    try {
      // First get the user's current weight
      const weightRecords = await pb.collection('weight_entries').getFullList({
        filter: `user_id = "${user.id}"`,
        sort: '-date',
        limit: 1
      });
      
      const startingWeight = weightRecords?.[0]?.weight;
      
      // Insert the participant with their starting weight
      await pb.collection('competition_participants').create({
        competition_id: competitionId,
        user_id: user.id,
        start_weight: startingWeight,
        current_weight: startingWeight,
        joined_at: new Date().toISOString()
      });

      fetchMyCompetitions();
    } catch (error) {
      console.error('Error joining competition:', error);
    }
  };

  const handleDeleteCompetition = async (competitionId: string) => {
    if (!user) return;

    try {
      // First delete all participants
      const participants = await pb.collection('competition_participants').getFullList({
        filter: `competition_id = "${competitionId}"`
      });
      
      for (const participant of participants) {
        await pb.collection('competition_participants').delete(participant.id);
      }

      // Then delete the competition
      await pb.collection('competitions').delete(competitionId);

      // Refresh the competitions list
      fetchMyCompetitions();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting competition:', error);
      alert('Failed to delete competition. Please try again.');
    }
  };

  const canDeleteCompetition = (competition: Competition) => {
    return competition.created_by === user?.id || can('competitions', 'delete');
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
          {displayParticipants.map((participant, index) => (
            <div
              key={participant.user.id}
              className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden"
              style={{ zIndex: maxDisplay - index }}
              title={participant.user.username || participant.user.email}
            >
              {participant.avatarUrl ? (
                <img
                  src={participant.avatarUrl}
                  alt={participant.user.username || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-indigo-600 text-white text-xs font-medium">
                  {(participant.user.username?.[0] || participant.user.email?.[0] || '?').toUpperCase()}
                </div>
              )}
            </div>
          ))}
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Competitions</h1>
        <div className="flex space-x-4">
          <Button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Join Competition
          </Button>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Create Competition
          </Button>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-medium mb-6">My Competitions</h2>
        {myCompetitions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">You haven&apos;t joined any competitions yet</p>
            <Button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Browse Competitions
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCompetitions.map((participation) => (
              <div
                key={participation.id}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => participation.expand?.competition_id && router.push(`/competitions/${participation.expand.competition_id.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 flex-grow">
                      {participation.expand?.competition_id?.name}
                    </h3>
                    <div className="flex items-center space-x-2 ml-2">
                      {participation.expand?.competition_id?.status && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          participation.expand.competition_id.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : participation.expand.competition_id.status === 'active'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {participation.expand.competition_id.status.charAt(0).toUpperCase() + 
                           participation.expand.competition_id.status.slice(1)}
                        </span>
                      )}
                      {participation.expand?.competition_id && canDeleteCompetition(participation.expand.competition_id) && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(participation.expand!.competition_id!.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
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
                  
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {participation.expand?.competition_id?.description || 'No description provided'}
                  </p>
                  
                  {/* Participant avatars */}
                  {participation.expand?.competition_id?.id && (
                    <div className="mb-4">
                      {renderParticipantAvatars(participation.expand.competition_id.id)}
                    </div>
                  )}
                  
                  <div className="flex items-center text-xs text-gray-400 mb-4">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {participation.expand?.competition_id?.end_date &&
                      (() => {
                        const daysLeft = calculateDaysLeft(participation.expand.competition_id.end_date);
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
                    {participation.expand?.competition_id?.status === 'upcoming' && (
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => {
                            setSelectedCompetition(participation.expand!.competition_id!);
                            setIsInviteModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-600 hover:text-indigo-500"
                        >
                          Invite Members
                        </Button>
                      </div>
                    )}
                  </div>
                  {participation.expand?.competition_id?.status === 'active' && (
                    <LeaderboardCard 
                      competitionId={participation.expand.competition_id.id} 
                      isEnded={false}
                    />
                  )}
                  {participation.expand?.competition_id?.status === 'completed' && (
                    <LeaderboardCard 
                      competitionId={participation.expand.competition_id.id} 
                      isEnded={true}
                    />
                  )}
                </div>
              </div>
            ))}
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
