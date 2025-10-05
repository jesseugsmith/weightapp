'use client';

import { useState, useEffect } from 'react';
import { pb } from '@/lib/pocketbase';
import { Competition } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';

interface JoinCompetitionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onJoinCompetition: (competitionId: string) => Promise<void>;
}

export default function JoinCompetitionsModal({
  isOpen,
  onClose,
  userId,
  onJoinCompetition,
}: JoinCompetitionsModalProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCompetitions();
    }
  }, [isOpen]);

  const fetchCompetitions = async () => {
    try {
      // Get competitions that are still in draft status and haven't ended
      const competitions = await pb.collection('competitions').getFullList({
        filter: `end_date >= "${new Date().toISOString()}" && status = "draft"`,
        sort: 'start_date',
      });

      // Get current user's participations to filter out competitions they've already joined
      const participations = await pb.collection('competition_participants').getFullList({
        filter: `user_id = "${userId}"`,
      });

      const participatedCompetitionIds = participations.map(p => p.competition_id);
      
      // Filter out competitions where the user is already a participant
      const filteredCompetitions = competitions.filter(comp => 
        !participatedCompetitionIds.includes(comp.id)
      );

      setCompetitions(filteredCompetitions as Competition[]);
    } catch (error) {
      console.error('Error fetching competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (competitionId: string) => {
    setJoiningId(competitionId);
    try {
      await onJoinCompetition(competitionId);
      // Remove the joined competition from the list
      setCompetitions(prev => prev.filter(c => c.id !== competitionId));
    } finally {
      setJoiningId(null);
    }
  };

  const filteredCompetitions = competitions.filter(competition =>
    competition.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    competition.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Join a Competition</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search competitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="Loading competitions..." />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {filteredCompetitions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                {searchTerm ? 'No competitions match your search' : 'No competitions available to join'}
              </p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredCompetitions.map((competition) => (
                  <li key={competition.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">
                          {competition.name}
                        </h3>
                        <p className="text-sm text-gray-500">{competition.description}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(competition.start_date).toLocaleDateString()} -{' '}
                          {new Date(competition.end_date).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoin(competition.id)}
                        disabled={joiningId === competition.id}
                        className={`ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white 
                          ${joiningId === competition.id
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                          }`}
                      >
                        {joiningId === competition.id ? 'Joining...' : 'Join'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
