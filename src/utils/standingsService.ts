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
      
      // Simple query first to test basic connectivity
      const { data: standings, error } = await supabase
        .from('competition_participants')
        .select('*')
        .eq('competition_id', competitionId)
        .eq('is_active', true);

      console.log('Raw query result:', { standings, error });

      if (error) {
        console.error('Supabase error in getCurrentStandings:', error);
        throw error;
      }

      if (!standings || standings.length === 0) {
        console.warn('No standings data returned for competition:', competitionId);
        return [];
      }

      // Now try to get profiles
      const userIds = standings.map(s => s.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', userIds);

      console.log('Profiles query result:', { profiles, profilesError });

      // Map the data together
      return standings.map(standing => {
        const profile = profiles?.find(p => p.id === standing.user_id);
        return {
          ...standing,
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

      return participants.map(participant => {
        const profile = (participant as any).profiles;
        return {
          ...participant,
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
   */
  async getLeaderboard(competitionId: string) {
    try {
      const supabase = createBrowserClient();
      
      const [standings, competitionResult] = await Promise.all([
        this.getCurrentStandings(competitionId),
        supabase
          .from('competitions')
          .select('*')
          .eq('id', competitionId)
          .single()
      ]);

      if (competitionResult.error) throw competitionResult.error;
      const competition = competitionResult.data;

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
          isCalculated: false
        };
      }

      return {
        competition,
        standings,
        isCalculated: true
      };
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  },

  /**
   * Get user's rank in a specific competition
   */
  async getUserRank(competitionId: string, userId: string): Promise<number | undefined> {
    try {
      const supabase = createBrowserClient();
      
      const { data: standing, error } = await supabase
        .from('competition_participants')
        .select('rank')
        .eq('competition_id', competitionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (error) throw error;
      return standing?.rank;
    } catch (error) {
      // If no standing found, try to get from participants
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
    }
  }
};

export default standingsService;
