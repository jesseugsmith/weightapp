import { createBrowserClient } from '@/lib/supabase';
import type { Competition, CompetitionParticipant, Profile } from '@/types/supabase.types';

export interface StandingWithUser extends CompetitionParticipant {
  profile?: Profile;
  expand?: {
    user_id: {
      id: string;
      name?: string;
      email: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

export interface ParticipantWithUser extends CompetitionParticipant {
  profile?: Profile;
  expand?: {
    user_id: {
      id: string;
      name?: string;
      email: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

export interface TeamStanding {
  team_id: string;
  team_name: string;
  team_score: number;
  team_change_percentage: number;
  rank: number;
  member_count: number;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  contribution: number;
}

export const standingsService = {
  /**
   * Get current standings for a competition
   */
  async getCurrentStandings(competitionId: string): Promise<StandingWithUser[]> {
    try {
      const supabase = createBrowserClient();
      
      console.log('Fetching standings for competition:', competitionId);
      
      // First, let's check if the user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Current user:', user?.id, 'Auth error:', authError);
      
      // Fetch participants
      const { data: participants, error: participantsError } = await supabase
        .from('competition_participants')
        .select('*')
        .eq('competition_id', competitionId)
        .eq('is_active', true);

      console.log('Participants query result:', { participants, error: participantsError });

      if (participantsError) {
        console.error('Supabase error fetching participants:', participantsError);
        throw participantsError;
      }

      if (!participants || participants.length === 0) {
        console.warn('No participants data returned for competition:', competitionId);
        return [];
      }

      // Fetch calculation results to get proper ranks
      const participantIds = participants.map(p => p.id);
      const { data: calculationResults, error: calcError } = await supabase
        .from('calculation_results')
        .select('subject_id, rank, calculated_score')
        .eq('competition_id', competitionId)
        .eq('subject_type', 'participant')
        .in('subject_id', participantIds);

      console.log('Calculation results query:', { calculationResults, error: calcError });

      // Create a map of participant_id -> rank from calculation_results
      const rankMap = new Map<string, number>();
      if (calculationResults) {
        calculationResults.forEach(cr => {
          if (cr.rank !== null && cr.rank !== undefined) {
            rankMap.set(cr.subject_id, cr.rank);
          }
        });
      }

      // Now try to get profiles
      const userIds = participants.map(s => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', userIds);

      console.log('Profiles query result:', { profiles, profilesError });

      // Map the data together with ranks from calculation_results
      const standings = participants.map(participant => {
        const profile = profiles?.find(p => p.id === participant.user_id);
        const rankFromCalc = rankMap.get(participant.id);
        
        return {
          ...participant,
          // Use rank from calculation_results if available, otherwise fall back to participant.rank
          rank: rankFromCalc !== undefined ? rankFromCalc : participant.rank,
          profile,
          expand: {
            user_id: {
              id: profile?.id || '',
              first_name: profile?.first_name,
              last_name: profile?.last_name,
              email: '',
            }
          }
        };
      }).sort((a, b) => {
        // Sort by rank (nulls last), then by weight_change_percentage (descending)
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank && !b.rank) return -1;
        if (!a.rank && b.rank) return 1;
        return (b.weight_change_percentage || 0) - (a.weight_change_percentage || 0);
      });

      return standings;
    } catch (error) {
      console.error('Error fetching current standings:', error);
      return [];
    }
  },

  /**
   * Get standings for a specific user across all competitions
   */
  async getUserStandings(userId: string): Promise<StandingWithUser[]> {
    try {
      const supabase = createBrowserClient();
      
      const { data: standings, error } = await supabase
        .from('competition_participants')
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            avatar
          ),
          competitions (
            id,
            name,
            status,
            start_date,
            end_date
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('rank', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Supabase error in getUserStandings:', error);
        throw error;
      }

      if (!standings) {
        console.warn('No user standings data returned for user:', userId);
        return [];
      }

      return standings.map(standing => {
        const profile = (standing as any).profiles;
        return {
          ...standing,
          profile,
          expand: {
            user_id: {
              id: profile?.id || '',
              first_name: profile?.first_name,
              last_name: profile?.last_name,
              email: profile?.email || '',
            }
          }
        };
      });
    } catch (error) {
      console.error('Error fetching user standings:', error);
      return [];
    }
  },

  /**
   * Get competition participants with user details (fallback if standings don't exist)
   */
  async getParticipantsAsStandings(competitionId: string): Promise<ParticipantWithUser[]> {
    try {
      const supabase = createBrowserClient();
      
      const { data: participants, error } = await supabase
        .from('competition_participants')
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name,
            avatar
          )
        `)
        .eq('competition_id', competitionId)
        .eq('is_active', true)
        .order('weight_change_percentage', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Supabase error in getParticipantsAsStandings:', error);
        throw error;
      }

      if (!participants) {
        console.warn('No participants data returned for competition:', competitionId);
        return [];
      }

      // Try to get ranks from calculation_results
      const participantIds = participants.map(p => p.id);
      const { data: calculationResults } = await supabase
        .from('calculation_results')
        .select('subject_id, rank')
        .eq('competition_id', competitionId)
        .eq('subject_type', 'participant')
        .in('subject_id', participantIds);

      // Create a map of participant_id -> rank
      const rankMap = new Map<string, number>();
      if (calculationResults) {
        calculationResults.forEach(cr => {
          if (cr.rank !== null && cr.rank !== undefined) {
            rankMap.set(cr.subject_id, cr.rank);
          }
        });
      }

      return participants.map((participant, index) => {
        const profile = (participant as any).profiles;
        const rankFromCalc = rankMap.get(participant.id);
        
        return {
          ...participant,
          // Use rank from calculation_results if available, otherwise use index + 1
          rank: rankFromCalc !== undefined ? rankFromCalc : (index + 1),
          profile,
          expand: {
            user_id: {
              id: profile?.id || '',
              first_name: profile?.first_name,
              last_name: profile?.last_name,
              email: profile?.email || '',
            }
          }
        };
      }).sort((a, b) => {
        // Sort by rank if available
        if (a.rank && b.rank) return a.rank - b.rank;
        if (a.rank && !b.rank) return -1;
        if (!a.rank && b.rank) return 1;
        // Otherwise sort by weight_change_percentage
        return (b.weight_change_percentage || 0) - (a.weight_change_percentage || 0);
      });
    } catch (error) {
      console.error('Error fetching participants:', error);
      return [];
    }
  },

  /**
   * Manually trigger standings recalculation (if needed)
   */
  async triggerStandingsRecalculation(competitionId: string): Promise<boolean> {
    try {
      const supabase = createBrowserClient();
      
      // Update the competition's updated_at timestamp to trigger any related database functions
      const { error } = await supabase
        .from('competitions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', competitionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error triggering standings recalculation:', error);
      return false;
    }
  },

  /**
   * Get leaderboard data with additional metrics
   * Automatically handles team competitions vs individual competitions
   */
  async getLeaderboard(competitionId: string) {
    try {
      const supabase = createBrowserClient();
      
      // First get competition to determine mode
      const { data: competition, error: compError } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single();

      if (compError) throw compError;

      // Handle team competitions
      if (competition.competition_mode === 'team') {
        const teamStandings = await this.getTeamStandings(competitionId);
        return {
          competition,
          standings: [], // Individual standings not applicable for team mode
          teams: teamStandings,
          isTeamCompetition: true,
          isCalculated: teamStandings.length > 0,
        };
      }

      // Handle individual/collaborative competitions
      const standings = await this.getCurrentStandings(competitionId);

      // If no standings exist, fall back to participants
      if (standings.length === 0) {
        const participants = await this.getParticipantsAsStandings(competitionId);
        return {
          competition,
          standings: participants.map((participant, index) => ({
            ...participant,
            rank: index + 1,
            calculated_at: new Date().toISOString(),
            is_current: true
          })),
          isTeamCompetition: false,
          isCalculated: false
        };
      }

      return {
        competition,
        standings,
        isTeamCompetition: false,
        isCalculated: true
      };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  },

  /**
   * Get team standings for a team competition
   */
  async getTeamStandings(competitionId: string): Promise<TeamStanding[]> {
    try {
      const supabase = createBrowserClient();

      // Fetch team calculation results
      const { data: teamResults, error: teamError } = await supabase
        .from('calculation_results')
        .select('*')
        .eq('competition_id', competitionId)
        .eq('subject_type', 'team')
        .order('rank', { ascending: true, nullsFirst: false });

      if (teamError) {
        console.error('Error fetching team results:', teamError);
        return [];
      }

      if (!teamResults || teamResults.length === 0) {
        console.log('No team results found for competition:', competitionId);
        return [];
      }

      // Get team details for each team
      const teamIds = teamResults.map(r => r.subject_id);
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          avatar,
          members:team_members(
            id,
            user_id,
            status,
            user:profiles!team_members_user_id_fkey(
              id,
              first_name,
              last_name,
              nickname,
              avatar
            )
          )
        `)
        .in('id', teamIds);

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return [];
      }

      // Helper to get display name
      const getDisplayName = (user: any): string => {
        if (!user) return 'Unknown';
        if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
        return user.nickname || user.first_name || 'Unknown';
      };

      // Transform and merge data
      const teamStandings: TeamStanding[] = teamResults.map((result: any) => {
        const team = teams?.find(t => t.id === result.subject_id);
        const calcData = result.calculation_data || {};

        const members: TeamMember[] = (team?.members || [])
          .filter((m: any) => m.status === 'active')
          .map((m: any) => ({
            id: m.user?.id || m.user_id,
            name: getDisplayName(m.user),
            avatar: m.user?.avatar,
            contribution: 0, // Individual contribution would need to be fetched from participant results
          }));

        return {
          team_id: result.subject_id,
          team_name: team?.name || 'Unknown Team',
          team_score: result.calculated_score ?? 0,
          team_change_percentage: calcData.value_change_percentage ?? 0,
          rank: result.rank ?? 0,
          member_count: calcData.member_count ?? members.length,
          members,
        };
      });

      return teamStandings;
    } catch (error) {
      console.error('Error fetching team standings:', error);
      return [];
    }
  },

  /**
   * Get team leaderboard data with competition details
   */
  async getTeamLeaderboard(competitionId: string) {
    try {
      const supabase = createBrowserClient();

      const [teamStandings, competitionResult] = await Promise.all([
        this.getTeamStandings(competitionId),
        supabase
          .from('competitions')
          .select('*')
          .eq('id', competitionId)
          .single()
      ]);

      if (competitionResult.error) throw competitionResult.error;
      const competition = competitionResult.data;

      return {
        competition,
        teams: teamStandings,
        isCalculated: teamStandings.length > 0,
      };
    } catch (error) {
      console.error('Error fetching team leaderboard:', error);
      throw error;
    }
  },

  /**
   * Get user's rank in a specific competition
   */
  async getUserRank(competitionId: string, userId: string): Promise<number | undefined> {
    try {
      const supabase = createBrowserClient();
      
      // First, get the participant ID for this user
      const { data: participant, error: participantError } = await supabase
        .from('competition_participants')
        .select('id')
        .eq('competition_id', competitionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (participantError || !participant) {
        throw participantError || new Error('Participant not found');
      }

      // Get rank from calculation_results
      const { data: calcResult, error: calcError } = await supabase
        .from('calculation_results')
        .select('rank')
        .eq('competition_id', competitionId)
        .eq('subject_type', 'participant')
        .eq('subject_id', participant.id)
        .single();

      if (!calcError && calcResult?.rank !== null && calcResult?.rank !== undefined) {
        return calcResult.rank;
      }

      // Fallback to participant rank if calculation_results doesn't have it
      const { data: standing, error } = await supabase
        .from('competition_participants')
        .select('rank')
        .eq('competition_id', competitionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!error && standing?.rank !== null && standing?.rank !== undefined) {
        return standing.rank;
      }

      // Last resort: calculate rank from participants
      try {
        const participants = await this.getParticipantsAsStandings(competitionId);
        const userParticipant = participants.find(p => p.user_id === userId);
        
        if (userParticipant) {
          return participants.indexOf(userParticipant) + 1;
        }
      } catch (participantError) {
        console.error('Error fetching user rank from participants:', participantError);
      }
      
      return undefined;
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return undefined;
    }
  }
};

export default standingsService;
