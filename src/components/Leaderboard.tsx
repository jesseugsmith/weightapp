/**
 * Competition Leaderboard Component
 * Displays current standings for a competition with real-time updates
 */

'use client';

import { useState, useEffect } from 'react';
import { standingsService, type StandingWithUser, type ParticipantWithUser } from '@/utils/standingsService';
import type { Competition } from '@/types/database.types';
import LoadingSpinner from './LoadingSpinner';

interface LeaderboardProps {
  competitionId: string;
  showHeader?: boolean;
  maxEntries?: number;
  currentUserId?: string;
}

interface LeaderboardData {
  competition: Competition;
  standings: (StandingWithUser | (ParticipantWithUser & { rank: number; calculated_at: string; is_current: boolean }))[];
  isCalculated: boolean;
}

export default function Leaderboard({ 
  competitionId, 
  showHeader = true, 
  maxEntries, 
  currentUserId 
}: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchLeaderboard = async () => {
    try {
      setError(null);
      const data = await standingsService.getLeaderboard(competitionId);
      setLeaderboard(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    
    return () => clearInterval(interval);
  }, [competitionId]);

  const formatWeightChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)} lbs`;
  };

  const formatPercentage = (percentage: number): string => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const getRankBadgeColor = (rank: number): string => {
    switch (rank) {
      case 1: return 'bg-yellow-500 text-white'; // Gold
      case 2: return 'bg-gray-400 text-white';   // Silver
      case 3: return 'bg-amber-600 text-white';  // Bronze
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getRowHighlight = (userId: string): string => {
    if (currentUserId && userId === currentUserId) {
      return 'bg-blue-50 ring-2 ring-blue-200';
    }
    return 'hover:bg-gray-50';
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading leaderboard..." />;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={fetchLeaderboard}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!leaderboard) {
    return <div>No leaderboard data available</div>;
  }

  const displayStandings = maxEntries 
    ? leaderboard.standings.slice(0, maxEntries) 
    : leaderboard.standings;

  return (
    <div className="bg-white rounded-lg shadow">
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {leaderboard.competition.name} - Leaderboard
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {leaderboard.competition.competition_type === 'weight_loss' && 'Most weight lost wins'}
                {leaderboard.competition.competition_type === 'weight_gain' && 'Most weight gained wins'}
                {leaderboard.competition.competition_type === 'body_fat_loss' && 'Most body fat lost wins'}
                {leaderboard.competition.competition_type === 'muscle_gain' && 'Most muscle gained wins'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
              {!leaderboard.isCalculated && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Calculated from participant data
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        {displayStandings.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No participants with weight data yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participant
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Weight Change
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Update
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayStandings.map((standing) => {
                  const user = standing.expand?.user_id;
                  const displayName = user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.name || user?.email || 'Unknown';

                  return (
                    <tr 
                      key={standing.id} 
                      className={getRowHighlight(standing.user_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${getRankBadgeColor(standing.rank)}`}>
                          {standing.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {displayName}
                              {currentUserId === standing.user_id && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">
                                  (You)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={`font-medium ${
                          (standing.weight_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatWeightChange(standing.weight_change || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={`font-medium ${
                          (standing.weight_change_percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercentage(standing.weight_change_percentage || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {standing.last_weight_entry 
                          ? new Date(standing.last_weight_entry).toLocaleDateString()
                          : 'No data'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {maxEntries && leaderboard.standings.length > maxEntries && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Showing top {maxEntries} of {leaderboard.standings.length} participants
          </p>
        </div>
      )}
    </div>
  );
}
