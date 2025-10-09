'use client';

import { useState, useEffect } from 'react';
import { standingsService, type StandingWithUser } from '@/utils/standingsService';
import type { Competition } from '@/types/database.types';
import LoadingSpinner from './LoadingSpinner';

interface LeaderboardCardProps {
  competitionId: string;
  isEnded?: boolean;
  maxEntries?: number;
}

interface LeaderboardData {
  competition: Competition;
  standings: any[]; // Mixed type to handle both StandingWithUser and fallback participant data
  isCalculated: boolean;
}

export default function LeaderboardCard({ 
  competitionId, 
  isEnded = false, 
  maxEntries = 5 
}: LeaderboardCardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setError(null);
        const data = await standingsService.getLeaderboard(competitionId);
        setLeaderboard(data);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
    
    // Auto-refresh every 30 seconds for live competitions
    if (!isEnded) {
      const interval = setInterval(fetchLeaderboard, 30000);
      return () => clearInterval(interval);
    }
  }, [competitionId, isEnded]);

  const formatWeightChange = (change: number, competitionType: string): string => {
    const absChange = Math.abs(change);
    if (change === 0) return `No change`;
    
    // For weight loss competitions, positive change means lost weight
    if (competitionType === 'weight_loss' || competitionType === 'body_fat_loss') {
      return change > 0 ? `Lost ${absChange.toFixed(1)} lbs` : `Gained ${absChange.toFixed(1)} lbs`;
    }
    
    // For weight gain competitions, positive change means gained weight
    if (competitionType === 'weight_gain' || competitionType === 'muscle_gain') {
      return change > 0 ? `Gained ${absChange.toFixed(1)} lbs` : `Lost ${absChange.toFixed(1)} lbs`;
    }
    
    return change > 0 ? `Gained ${absChange.toFixed(1)} lbs` : `Lost ${absChange.toFixed(1)} lbs`;
  };

  const formatPercentage = (percentage: number, competitionType: string): string => {
    // For weight loss competitions, positive change means weight was lost, so show negative percentage
    // For weight gain competitions, positive change means weight was gained, so show positive percentage
    let adjustedPercentage = percentage;
    
    if (competitionType === 'weight_loss' || competitionType === 'body_fat_loss') {
      adjustedPercentage = -percentage; // Flip the sign for weight loss competitions
    }
    
    const sign = adjustedPercentage >= 0 ? '+' : '';
    return `${sign}${adjustedPercentage.toFixed(1)}%`;
  };

  const getCompetitionTypeLabel = (type: string): string => {
    switch (type) {
      case 'weight_loss': return 'Weight Loss Battle';
      case 'weight_gain': return 'Weight Gain Challenge';
      case 'body_fat_loss': return 'Body Fat Reduction';
      case 'muscle_gain': return 'Muscle Building';
      default: return 'Fitness Competition';
    }
  };

  const getRankEmoji = (rank: number): string => {
    switch (rank) {
      case 1: return '👑';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '';
    }
  };

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-gray-300';
      case 3: return 'text-amber-600';
      default: return 'text-gray-500';
    }
  };

  const getProgressColor = (change: number, competitionType: string): string => {
    const isPositive = change > 0;
    
    // For weight loss and body fat loss, positive change (loss) is good
    if (competitionType === 'weight_loss' || competitionType === 'body_fat_loss') {
      return isPositive ? 'text-[var(--success)]' : 'text-[var(--error)]';
    }
    
    // For weight gain and muscle gain, positive change (gain) is good
    if (competitionType === 'weight_gain' || competitionType === 'muscle_gain') {
      return isPositive ? 'text-[var(--success)]' : 'text-[var(--error)]';
    }
    
    return isPositive ? 'text-[var(--success)]' : 'text-[var(--error)]';
  };

  const getProgressIcon = (change: number, competitionType: string): string => {
    const isPositive = change > 0;
    
    if (competitionType === 'weight_loss' || competitionType === 'body_fat_loss') {
      return isPositive ? '💪' : '⚠️';
    }
    
    if (competitionType === 'weight_gain' || competitionType === 'muscle_gain') {
      return isPositive ? '💪' : '⚠️';
    }
    
    return isPositive ? '💪' : '⚠️';
  };

  if (loading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <div className="bg-opacity-10 backdrop-blur-lg shadow-lg rounded-lg p-6 border border-red-500">
        <div className="text-red-500 text-center">
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!leaderboard) {
    return (
      <div className="bg-opacity-10 backdrop-blur-lg shadow-lg rounded-lg p-6 border border-[var(--accent)]">
        <p className="text-center text-gray-500">No leaderboard data available</p>
      </div>
    );
  }

  const displayStandings = leaderboard.standings.slice(0, maxEntries);
  const competitionType = leaderboard.competition.competition_type || 'weight_loss';

  return (
    <div className="bg-opacity-10 backdrop-blur-lg shadow-lg rounded-lg p-6 border border-[var(--accent)] game-glow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-[var(--accent)] game-float">
          {getCompetitionTypeLabel(competitionType)}
        </h3>
        {!leaderboard.isCalculated && (
          <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded">
            Live Calculation
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        {displayStandings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>🏁 No participants with weight data yet</p>
            <p className="text-sm mt-1">Be the first to log your weight!</p>
          </div>
        ) : (
          displayStandings.map((standing) => {
            const user = standing.expand?.user_id;
            const displayName = user?.first_name && user?.last_name 
              ? `${user.first_name} ${user.last_name}`
              : user?.name || user?.email || 'Unknown Fighter';
            
            const weightChange = standing.weight_change || 0;
            const percentage = standing.weight_change_percentage || 0;

            return (
              <div
                key={standing.id}
                className="flex items-center justify-between p-4 bg-opacity-20 backdrop-blur-md rounded-lg border border-gray-800 hover:border-[var(--accent)] transition-all duration-300"
              >
                <div className="flex items-center space-x-4">
                  <span className={`text-xl font-bold ${getRankColor(standing.rank)} game-float`}>
                    {getRankEmoji(standing.rank)} #{standing.rank}
                  </span>
                  <div>
                    <p className="font-bold text-[var(--accent)]">{displayName}</p>
                    <p className="text-sm mt-1">
                      <span className={`font-medium ${getProgressColor(weightChange, competitionType)}`}>
                        {formatWeightChange(weightChange, competitionType)} {getProgressIcon(weightChange, competitionType)}
                      </span>
                      <span className="ml-2 text-gray-400">
                        🎯 {formatPercentage(percentage, competitionType)}
                      </span>
                    </p>
                    {standing.last_weight_entry && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last update: {new Date(standing.last_weight_entry).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                
                {isEnded && standing.rank <= 3 && (
                  <div className="text-right">
                    <p className="text-[var(--success)] font-bold text-lg game-float">
                      🏆 Winner!
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      {leaderboard.standings.length > maxEntries && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            Showing top {maxEntries} of {leaderboard.standings.length} fighters
          </p>
        </div>
      )}
      
      {!isEnded && displayStandings.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            🔄 Auto-updates every 30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
