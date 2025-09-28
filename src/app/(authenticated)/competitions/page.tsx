'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { Competition, CompetitionParticipant } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import CreateCompetitionModal from '@/components/CreateCompetitionModal';
import InviteMembersModal from '@/components/InviteMembersModal';
import JoinCompetitionsModal from '@/components/JoinCompetitionsModal';
import LeaderboardCard from '@/components/LeaderboardCard';

export default function Competitions() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [myCompetitions, setMyCompetitions] = useState<CompetitionParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

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
      const { error } = await supabase
        .from('competition_participants')
        .insert([
          {
            competition_id: competitionId,
            user_id: user.id,
          },
        ]);

      if (error) throw error;

      fetchMyCompetitions();
    } catch (error) {
      console.error('Error joining competition:', error);
    }
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
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 flex-grow">
                      {participation.competition?.name}
                    </h3>
                    {participation.competition?.status && (
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
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
    </div>
  );
}
