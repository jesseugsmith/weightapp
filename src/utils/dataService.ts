import { pb } from '@/lib/pocketbase';

import type { WeightEntry, Competition } from '@/types/database.types';
import { start } from 'repl';

// Weight tracking functions
export const weightService = {
  async logWeight(data: Omit<WeightEntry, 'id' | 'created' | 'updated'>) {
    try {
      const result = await pb.collection('weight_entries').create(data);
      return result;
    } catch (error) {
      console.error('Error logging weight:', error);
      throw error;
    }
  },
  async getWeightHistory(userId: string, limit: number = 50) {
    try {
      const result = await pb.collection('weight_entries').getList(1, limit, {
        filter: `user_id = "${userId}"`,
        sort: '-date',
      });
      return result;
    } catch (error) {
      console.error('Error getting weight history:', error);
      throw error;
    }
  },

  async updateWeight(id: string, data: Partial<WeightEntry>) {
    try {
      const result = await pb.collection('weight_entries').update(id, data);
      return result;
    } catch (error) {
      console.error('Error updating weight:', error);
      throw error;
    }
  },

  async deleteWeight(id: string) {
    try {
      await pb.collection('weight_entries').delete(id);
    } catch (error) {
      console.error('Error deleting weight:', error);
      throw error;
    }
  }
};

// Competition functions
export const competitionService = {
  async createCompetition(data: Omit<Competition, 'id' | 'created' | 'updated'>) {
    try {
      const result = await pb.collection('competitions').create(data);
      return result;
    } catch (error) {
      console.error('Error creating competition:', error);
      throw error;
    }
  },

  async startCompetition(competitionId: string) {
    try {
      const result = await pb.send(`/api/competitions/start/${competitionId}`, { method: 'POST' });
      return result;
    } catch (error) {
      console.error('Error starting competition:', error);
      throw error;
    }
  },
  async getCompetitions(filter?: string, limit: number = 20) {
    try {
      const result = await pb.collection('competitions').getList(1, limit, {
        filter: filter || '',
        sort: '-created',
        expand: 'creator_id'
      });
      return result;
    } catch (error) {
      console.error('Error getting competitions:', error);
      throw error;
    }
  },

  async getCompetition(id: string) {
    try {
      const result = await pb.collection('competitions').getOne(id, {
        expand: 'creator_id'
      });
      return result;
    } catch (error) {
      console.error('Error getting competition:', error);
      throw error;
    }
  },

  async joinCompetition(competitionId: string, userId: string) {
    try {
      const data = {
        competition_id: competitionId,
        user_id: userId,
        joined_date: new Date().toISOString()
      };
      const result = await pb.collection('competition_participants').create(data);
      return result;
    } catch (error) {
      console.error('Error joining competition:', error);
      throw error;
    }
  },

  async getCompetitionParticipants(competitionId: string) {
    try {
      const result = await pb.collection('competition_participants').getList(1, 100, {
        filter: `competition_id = "${competitionId}"`,
        expand: 'user_id',
        sort: 'rank,weight_lost'
      });
      return result;
    } catch (error) {
      console.error('Error getting competition participants:', error);
      throw error;
    }
  },

  async getUserCompetitions(userId: string) {
    try {
      const result = await pb.collection('competition_participants').getList(1, 50, {
        filter: `user_id = "${userId}"`,
        expand: 'competition_id',
        sort: '-joined_date'
      });
      return result;
    } catch (error) {
      console.error('Error getting user competitions:', error);
      throw error;
    }
  },

  async updateParticipantWeight(participantId: string, weight: number) {
    try {
      const result = await pb.collection('competition_participants').update(participantId, {
        current_weight: weight,
        weight_lost: 0 // This should be calculated based on starting_weight
      });
      return result;
    } catch (error) {
      console.error('Error updating participant weight:', error);
      throw error;
    }
  }
};

// User profile functions
export const userService = {
  async updateProfile(userId: string, data: any) {
    try {
      const result = await pb.collection('users').update(userId, data);
      return result;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async getProfile(userId: string) {
    try {
      const result = await pb.collection('users').getOne(userId);
      return result;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }
};
