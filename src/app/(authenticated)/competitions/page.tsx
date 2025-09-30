'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import { Competition, CompetitionParticipant } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import CreateCompetitionModal from '@/components/CreateCompetitionModal';
import InviteMembersModal from '@/components/InviteMembersModal';
import JoinCompetitionsModal from '@/components/JoinCompetitionsModal';
import LeaderboardCard from '@/components/LeaderboardCard';
import { usePermissions } from '@/contexts/PermissionContext';

export default function Competitions() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<CompetitionParticipant[]>([]);
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
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('status', 'started')
        .gte('end_date', new Date().toISOString())
        .order('start_date', { ascending: true });

      if (error) throw error;
      setCompetitions(data || []);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    }
  };

  const fetchMyCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from('competition_participants')
        .select(`
          *,
          competition:competitions(
            id,
            name,
            description,
            start_date,
            end_date,
            status,
            competition_participants(user_id)
          )
        `)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      // Filter out null competitions and sort by status
      const statusOrder: Record<string, number> = {
        'started': 0,
        'draft': 1,
        'completed': 2
      };

      const sortedCompetitions = (data || [])
        .filter(item => item.competition)
        .sort((a, b) => {
          // Custom sort order: started -> draft -> completed
          const statusA = a.competition?.status || 'completed';
          const statusB = b.competition?.status || 'completed';
          return (statusOrder[statusA] || 999) - (statusOrder[statusB] || 999);
        });

      setMyCompetitions(sortedCompetitions);
    } catch (error) {
      console.error('Error fetching my competitions:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleJoinCompetition = async (competitionId: string) => {
    if (!user) return;

    try {
      // First get the user's current weight
      const { data: weightData, error: weightError } = await supabase
        .from('weight_entries')
        .select('weight')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      if (weightError) throw weightError;
      
      const startingWeight = weightData?.[0]?.weight;
      
      // Insert the participant with their starting weight
      const { error } = await supabase
        .from('competition_participants')
        .insert([
          {
            competition_id: competitionId,
            user_id: user.id,
            starting_weight: startingWeight,
            current_weight: startingWeight
          },
        ]);

      if (error) throw error;

      fetchMyCompetitions();
    } catch (error) {
      console.error('Error joining competition:', error);
    }
  };

  const handleDeleteCompetition = async (competitionId: string) => {
    if (!user) return;

    try {
      // First delete all participants
      const { error: participantsError } = await supabase
        .from('competition_participants')
        .delete()
        .eq('competition_id', competitionId);

      if (participantsError) throw participantsError;

      // Then delete the competition
      const { error: competitionError } = await supabase
        .from('competitions')
        .delete()
        .eq('id', competitionId);

      if (competitionError) throw competitionError;

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

  if (loading) {
    return <LoadingSpinner message="Loading competitions..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Competitions</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Join Competition
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Create Competition
          </button>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-medium mb-6">My Competitions</h2>
        {myCompetitions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">You haven&apos;t joined any competitions yet</p>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Browse Competitions
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myCompetitions.map((participation) => (
              <div
                key={participation.id}
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => participation.competition && router.push(`/competitions/${participation.competition.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 flex-grow">
                      {participation.competition?.name}
                    </h3>
                    <div className="flex items-center space-x-2 ml-2">
                      {participation.competition?.status && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          participation.competition.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : participation.competition.status === 'started'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {participation.competition.status.charAt(0).toUpperCase() + 
                           participation.competition.status.slice(1)}
                        </span>
                      )}
                      {participation.competition && canDeleteCompetition(participation.competition) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(participation.competition!.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete competition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {participation.competition?.description || 'No description provided'}
                  </p>
                  
                  <div className="flex items-center text-xs text-gray-400 mb-4">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {participation.competition?.start_date &&
                      new Date(participation.competition.start_date).toLocaleDateString()}{' '}
                    -{' '}
                    {participation.competition?.end_date &&
                      new Date(participation.competition.end_date).toLocaleDateString()}
                  </div>

                  <div className="flex justify-between items-center">
                    {participation.competition?.status === 'draft' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedCompetition(participation.competition!);
                            setIsInviteModalOpen(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-600 hover:text-indigo-500"
                        >
                          Invite Members
                        </button>
                      </div>
                    )}
                  </div>
                  {participation.competition?.status === 'started' && (
                    <LeaderboardCard 
                      competitionId={participation.competition.id} 
                      isEnded={false}
                    />
                  )}
                  {participation.competition?.status === 'completed' && (
                    <LeaderboardCard 
                      competitionId={participation.competition.id} 
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
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCompetition(deleteConfirmId)}
                  className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
