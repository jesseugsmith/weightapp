'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { standingsService, type StandingWithUser, type TeamStanding } from '@/utils/standingsService';
import type { Competition } from '@/types/supabase.types';
import { LeaderboardSkeleton } from './skeletons';
import { Users, Trophy, ChevronDown, ChevronUp } from 'lucide-react';

interface LeaderboardCardProps {
  competitionId: string;
  isEnded?: boolean;
  maxEntries?: number;
}

interface LeaderboardData {
  competition: Competition;
  standings: any[]; // Mixed type to handle both StandingWithUser and fallback participant data
  teams?: TeamStanding[];
  isTeamCompetition?: boolean;
  isCalculated: boolean;
}

export default function LeaderboardCard({ 
  competitionId, 
  isEnded = false, 
  maxEntries = 5 
}: LeaderboardCardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
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

  if (loading) {
    return <LeaderboardSkeleton showPodium={true} participantCount={maxEntries} />;
  }
  
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

  // Handle team competitions
  if (leaderboard.isTeamCompetition && leaderboard.teams) {
    return (
      <TeamLeaderboardDisplay 
        teams={leaderboard.teams} 
        competition={leaderboard.competition}
        maxEntries={maxEntries}
        isEnded={isEnded}
      />
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

// Team Leaderboard Display Component
function TeamLeaderboardDisplay({ 
  teams, 
  competition,
  maxEntries = 5,
  isEnded = false
}: { 
  teams: TeamStanding[];
  competition: Competition;
  maxEntries?: number;
  isEnded?: boolean;
}) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const displayTeams = teams.slice(0, maxEntries);
  const isDraft = competition.status === 'draft';

  const toggleTeamExpansion = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return '';
    }
  };

  const getRankBgClass = (rank: number) => {
    switch (rank) {
      case 1: return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/50';
      case 2: return 'from-gray-400/20 to-gray-500/10 border-gray-400/50';
      case 3: return 'from-amber-600/20 to-amber-700/10 border-amber-600/50';
      default: return 'from-muted/50 to-muted/30 border-border';
    }
  };

  if (displayTeams.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Competition
          </h3>
        </div>
        <div className="bg-card border border-border rounded-lg shadow-sm p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">
            {isDraft ? '📝 Teams Getting Ready' : '🏆 No Teams Competing Yet'}
          </p>
          <p className="text-muted-foreground">
            {isDraft 
              ? 'Teams are being organized. Check back when the competition starts!'
              : 'Teams will appear here once they join and start competing!'}
          </p>
        </div>
      </div>
    );
  }

  // Separate top 3 and remaining teams
  const topThree = displayTeams.filter(t => t.rank <= 3);
  const remaining = displayTeams.filter(t => t.rank > 3);

  // Sort for podium display (2nd, 1st, 3rd)
  const podiumOrder = [
    topThree.find(t => t.rank === 2),
    topThree.find(t => t.rank === 1),
    topThree.find(t => t.rank === 3),
  ].filter(Boolean) as TeamStanding[];

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 max-w-7xl mx-auto px-6">
        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Leaderboard
        </h3>
        {isDraft && (
          <span className="text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded">
            Waiting to start
          </span>
        )}
      </div>

      {/* Top 3 Podium for Teams */}
      {!isDraft && topThree.length > 0 && (
        <div className="mb-8 w-full bg-muted/30 py-8 md:py-12">
          <div className="flex items-end justify-center gap-2 md:gap-4 max-w-4xl mx-auto px-2 md:px-4">
            {podiumOrder.map((team) => {
              const heightClass = team.rank === 1 ? 'h-56 md:h-64' : team.rank === 2 ? 'h-48 md:h-56' : 'h-40 md:h-48';
              const trophySize = team.rank === 1 ? 'text-4xl md:text-6xl' : 'text-3xl md:text-5xl';

              return (
                <div key={team.team_id} className="flex flex-col items-center w-[110px] md:w-[180px]">
                  {/* Trophy */}
                  <div className={`${trophySize} mb-2 md:mb-3`}>
                    {getRankEmoji(team.rank)}
                  </div>

                  {/* Card */}
                  <div className={`${heightClass} w-full bg-gradient-to-b ${getRankBgClass(team.rank)} border-2 rounded-lg p-2 md:p-4 flex flex-col justify-between`}>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <Users className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      </div>
                      <div className="font-bold text-foreground text-xs md:text-sm mb-2 line-clamp-2 px-1">
                        {team.team_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {team.member_count} members
                      </div>
                    </div>

                    <div className="text-center space-y-1 md:space-y-2">
                      <div className="text-sm md:text-lg font-bold text-foreground">
                        {team.team_score.toFixed(1)}
                      </div>
                      <div className={`text-xs md:text-sm ${
                        team.team_change_percentage > 0 ? 'text-green-600' :
                        team.team_change_percentage < 0 ? 'text-red-600' :
                        'text-muted-foreground'
                      }`}>
                        {team.team_change_percentage > 0 ? '+' : ''}{team.team_change_percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team List (all teams in draft mode, remaining teams otherwise) */}
      {(isDraft ? displayTeams : remaining).length > 0 && (
        <div className="space-y-3 max-w-4xl mx-auto px-4">
          {!isDraft && remaining.length > 0 && (
            <h4 className="text-lg font-semibold text-foreground mb-4">Other Teams</h4>
          )}
          {(isDraft ? displayTeams : remaining).map((team) => {
            const isExpanded = expandedTeams.has(team.team_id);
            
            return (
              <div
                key={team.team_id}
                className="bg-muted/50 rounded-lg border border-border overflow-hidden"
              >
                <button
                  onClick={() => toggleTeamExpansion(team.team_id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    {!isDraft && (
                      <span className="text-lg font-bold text-muted-foreground min-w-[3rem]">
                        #{team.rank}
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-foreground">{team.team_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {team.member_count} members
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {!isDraft && (
                      <div className="text-right">
                        <p className="font-bold text-foreground">{team.team_score.toFixed(1)}</p>
                        <p className={`text-sm ${
                          team.team_change_percentage > 0 ? 'text-green-600' :
                          team.team_change_percentage < 0 ? 'text-red-600' :
                          'text-muted-foreground'
                        }`}>
                          {team.team_change_percentage > 0 ? '+' : ''}{team.team_change_percentage.toFixed(1)}%
                        </p>
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Team Members */}
                {isExpanded && team.members.length > 0 && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Team Members</p>
                    <div className="space-y-2">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between py-2 px-3 bg-background rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {member.name[0]?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-sm font-medium">{member.name}</span>
                          </div>
                          {!isDraft && (
                            <span className={`text-sm ${
                              member.contribution > 0 ? 'text-green-600' :
                              member.contribution < 0 ? 'text-red-600' :
                              'text-muted-foreground'
                            }`}>
                              {member.contribution > 0 ? '+' : ''}{member.contribution.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {teams.length > maxEntries && (
        <div className="mt-4 text-center max-w-7xl mx-auto">
          <p className="text-sm text-muted-foreground">
            Showing top {maxEntries} of {teams.length} teams
          </p>
        </div>
      )}

      {!isEnded && displayTeams.length > 0 && (
        <div className="mt-4 text-center max-w-7xl mx-auto">
          <p className="text-xs text-muted-foreground">
            Auto-updates every 30 seconds
          </p>
        </div>
      )}
    </div>
  );
}
