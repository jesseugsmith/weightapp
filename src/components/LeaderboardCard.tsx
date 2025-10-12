'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { standingsService, type StandingWithUser } from '@/utils/standingsService';
import type { Competition, Prize } from '@/types/supabase.types';
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
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setError(null);
        const supabase = createBrowserClient();
        
        const data = await standingsService.getLeaderboard(competitionId);
        setLeaderboard(data);
        
        // Fetch prizes for this competition
        const { data: prizesData, error: prizesError } = await supabase
          .from('prizes')
          .select('*')
          .eq('competition_id', competitionId)
          .order('rank', { ascending: true });

        if (prizesError) throw prizesError;
        setPrizes(prizesData || []);
        
        // Fetch participant count
        const { data: participants, error: participantsError } = await supabase
          .from('competition_participants')
          .select('id')
          .eq('competition_id', competitionId);

        if (participantsError) throw participantsError;
        setParticipantCount(participants?.length || 0);
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

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1: return 'text-yellow-600 dark:text-yellow-500';
      case 2: return 'text-gray-500 dark:text-gray-400';
      case 3: return 'text-amber-600 dark:text-amber-500';
      default: return 'text-muted-foreground';
    }
  };

  const getProgressColor = (change: number, competitionType: string): string => {
    const isPositive = change > 0;
    
    // For weight loss and body fat loss, positive change (loss) is good
    if (competitionType === 'weight_loss' || competitionType === 'body_fat_loss') {
      return isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
    }
    
    // For weight gain and muscle gain, positive change (gain) is good
    if (competitionType === 'weight_gain' || competitionType === 'muscle_gain') {
      return isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
    }
    
    return isPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
  };

  // Calculate prize amount based on entry fee, participants, and percentage
  const calculatePrizeAmount = (percentage: number): number => {
    if (!leaderboard?.competition.entry_fee) return 0;
    const prizePool = leaderboard.competition.entry_fee * participantCount;
    return (prizePool * percentage) / 100;
  };

  if (loading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="bg-card border border-destructive rounded-lg shadow-sm p-6">
          <div className="text-destructive text-center">
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!leaderboard) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
          <p className="text-center text-muted-foreground">No leaderboard data available</p>
        </div>
      </div>
    );
  }

  const displayStandings = leaderboard.standings.slice(0, maxEntries);
  const competitionType = leaderboard.competition.competition_type || 'weight_loss';

  // Separate top 3 and remaining participants
  const topThree = displayStandings.filter(s => s.rank <= 3);
  const remaining = displayStandings.filter(s => s.rank > 3);

  // Sort top 3 for podium display (2nd, 1st, 3rd)
  const podiumOrder = [
    topThree.find(s => s.rank === 2),
    topThree.find(s => s.rank === 1),
    topThree.find(s => s.rank === 3),
  ].filter(Boolean);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto px-6">
        <h3 className="text-xl font-semibold text-foreground">
          {getCompetitionTypeLabel(competitionType)}
        </h3>
        <div className="flex items-center gap-4">
          {leaderboard.competition.entry_fee && leaderboard.competition.entry_fee > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Prize Pool: </span>
              <span className="font-bold text-green-600 dark:text-green-500">
                ${(leaderboard.competition.entry_fee * participantCount).toFixed(2)}
              </span>
              <span className="text-muted-foreground ml-1">
                ({participantCount} × ${leaderboard.competition.entry_fee})
              </span>
            </div>
          )}
          {!leaderboard.isCalculated && (
            <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded">
              Live Calculation
            </span>
          )}
        </div>
      </div>
      
      {displayStandings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground max-w-7xl mx-auto">
          <p>No participants with weight data yet</p>
          <p className="text-sm mt-1">Be the first to log your weight!</p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {topThree.length > 0 && (
            <div className="mb-8 w-full bg-muted/30 py-8 md:py-12">
              <div className="flex items-end justify-center gap-2 md:gap-4 max-w-4xl mx-auto px-2 md:px-4">
                {podiumOrder.map((standing) => {
                  if (!standing) return null;
                  
                  const user = standing.expand?.user_id;
                  const displayName = user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.name || user?.email || 'Unknown User';
                  
                  const weightChange = standing.weight_change || 0;
                  const percentage = standing.weight_change_percentage || 0;
                  
                  // Find prize for this rank
                  const prize = prizes.find(p => p.rank === standing.rank);
                  
                  const heightClass = standing.rank === 1 ? 'h-56 md:h-64' : standing.rank === 2 ? 'h-48 md:h-56' : 'h-40 md:h-48';
                  const trophySize = standing.rank === 1 ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl';
                  
                  return (
                    <div key={standing.id} className="flex flex-col items-center w-[110px] md:w-[180px]">
                      {/* Trophy */}
                      <div className={`${trophySize} mb-2 md:mb-3`}>
                        {standing.rank === 1 && '🏆'}
                        {standing.rank === 2 && '🥈'}
                        {standing.rank === 3 && '🥉'}
                      </div>
                      
                      {/* Card */}
                      <div className={`${heightClass} w-full bg-gradient-to-b ${
                        standing.rank === 1 
                          ? 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/50' 
                          : standing.rank === 2
                          ? 'from-gray-400/20 to-gray-500/10 border-gray-400/50'
                          : 'from-amber-600/20 to-amber-700/10 border-amber-600/50'
                      } border-2 rounded-lg p-2 md:p-4 flex flex-col justify-between`}>
                        <div className="text-center">
                          <div className="font-bold text-foreground text-xs md:text-sm mb-2 md:mb-3 line-clamp-2 px-1">
                            {displayName}
                          </div>
                          
                          {/* Prize */}
                          {prize && (
                            <div className="mb-2 md:mb-3 pb-2 md:pb-3 border-b border-border/50">
                              <div className="text-sm md:text-lg font-bold text-green-600 dark:text-green-500">
                                ${calculatePrizeAmount(prize.prize_amount || 0).toFixed(0)}
                              </div>
                              <div className="text-[10px] md:text-xs text-muted-foreground mt-1 hidden md:block">
                                {prize.prize_amount}% of pool
                              </div>
                              {prize.prize_description && (
                                <div className="text-[10px] md:text-xs text-muted-foreground mt-1 line-clamp-2 hidden md:block">
                                  {prize.prize_description}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-center space-y-1 md:space-y-2">
                          <div className={`text-sm md:text-lg font-bold ${getProgressColor(weightChange, competitionType)}`}>
                            {Math.abs(weightChange).toFixed(1)} lbs
                          </div>
                          <div className="text-xs md:text-sm text-muted-foreground">
                            {formatPercentage(percentage, competitionType)}
                          </div>
                          {standing.last_weight_entry && (
                            <div className="text-[10px] md:text-xs text-muted-foreground hidden md:block">
                              {new Date(standing.last_weight_entry).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Remaining Participants */}
          {remaining.length > 0 && (
            <div className="space-y-3 max-w-4xl mx-auto px-4">
              <h4 className="text-lg font-semibold text-foreground mb-4">Other Participants</h4>
              {remaining.map((standing) => {
                const user = standing.expand?.user_id;
                const displayName = user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}`
                  : user?.name || user?.email || 'Unknown User';
                
                const weightChange = standing.weight_change || 0;
                const percentage = standing.weight_change_percentage || 0;

                return (
                  <div
                    key={standing.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-lg font-bold text-muted-foreground min-w-[3rem]">
                        #{standing.rank}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{displayName}</p>
                        <p className="text-sm mt-1">
                          <span className={`font-medium ${getProgressColor(weightChange, competitionType)}`}>
                            {formatWeightChange(weightChange, competitionType)}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {formatPercentage(percentage, competitionType)}
                          </span>
                        </p>
                        {standing.last_weight_entry && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last update: {new Date(standing.last_weight_entry).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      
      {leaderboard.standings.length > maxEntries && (
        <div className="mt-4 text-center max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground">
            Showing top {maxEntries} of {leaderboard.standings.length} participants
          </p>
        </div>
      )}
      
      {!isEnded && displayStandings.length > 0 && (
        <div className="mt-4 text-center max-w-7xl mx-auto">
          <p className="text-xs text-muted-foreground">
            Auto-updates every 30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
