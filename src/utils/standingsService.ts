import { pb } from '@/lib/pocketbase';
import type {Competition, CompetitionParticipant } from '@/types/database.types';

export interface StandingWithUser extends CompetitionParticipant {
  expand?: {
    user_id: {
      id: string;
      name: string;
      email: string;
      first_name?: string;
      last_name?: string;
    };
  };
}

export interface ParticipantWithUser extends CompetitionParticipant {
  expand?: {
    user_id: {
      id: string;
      name: string;
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
      const standings = await pb.collection('competition_participants').getFullList<StandingWithUser>({
        filter: `competition_id = "${competitionId}" && is_active = true`,
        sort: 'rank',
        expand: 'user_id'
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
      const standings = await pb.collection('competition_participants').getFullList<StandingWithUser>({
        filter: `user_id = "${userId}" && is_active = true`,
        sort: 'rank',
        expand: 'competition_id'
      });

      return standings;
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
      const participants = await pb.collection('competition_participants').getFullList<ParticipantWithUser>({
        filter: `competition_id = "${competitionId}" && is_active = true`,
        sort: '-weight_loss_percentage', // Sort by best performance
        expand: 'user_id'
      });

      return participants;
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
      // Create a dummy weight entry update to trigger recalculation
      // This is a workaround since we can't directly call PocketBase hooks from frontend
      const competition = await pb.collection('competitions').getOne(competitionId);
      
      // Update the competition's updated timestamp to trigger any related hooks
      await pb.collection('competitions').update(competitionId, {
        updated: new Date().toISOString()
      });

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
      const [standings, competition] = await Promise.all([
        this.getCurrentStandings(competitionId),
        pb.collection('competitions').getOne<Competition>(competitionId)
      ]);

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
      const standing = await pb.collection('competition_participants').getFirstListItem<CompetitionParticipant>(
        `competition_id = "${competitionId}" && user_id = "${userId}" && is_active = true`
      );

      return standing.rank;
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
