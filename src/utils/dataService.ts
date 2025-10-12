import { createBrowserClient } from '@/lib/supabase';

import type { WeightEntry, Competition } from '@/types/database.types';
import { start } from 'repl';

// Weight tracking functions
export const weightService = {
  async logWeight(data: Omit<WeightEntry, 'id' | 'created' | 'updated'>) {
    try {
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('weight_entries')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error logging weight:', error);
      throw error;
    }
  },
  async getWeightHistory(userId: string, limit: number = 50) {
    try {
      const supabase = createBrowserClient();
      const { data: items, error, count } = await supabase
        .from('weight_entries')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Mimic PocketBase structure with page, perPage, totalItems
      return {
        page: 1,
        perPage: limit,
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        items: items || []
      };
    } catch (error) {
      console.error('Error getting weight history:', error);
      throw error;
    }
  },

  async updateWeight(id: string, data: Partial<WeightEntry>) {
    try {
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('weight_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error updating weight:', error);
      throw error;
    }
  },

  async deleteWeight(id: string) {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('weight_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('competitions')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error creating competition:', error);
      throw error;
    }
  },

  async startCompetition(competitionId: string) {
    try {
      // Call the custom API endpoint
      const supabase = createBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/competitions/start/${competitionId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to start competition');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error starting competition:', error);
      throw error;
    }
  },
  async getCompetitions(filter?: string, limit: number = 20) {
    try {
      const supabase = createBrowserClient();
      let query = supabase
        .from('competitions')
        .select('*, creator_id(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);

      // Note: You may need to adjust filter logic based on your specific needs
      
      const { data: items, error, count } = await query;

      if (error) throw error;

      return {
        page: 1,
        perPage: limit,
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        items: items || []
      };
    } catch (error) {
      console.error('Error getting competitions:', error);
      throw error;
    }
  },

  async getCompetition(id: string) {
    try {
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('competitions')
        .select('*, creator_id(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error getting competition:', error);
      throw error;
    }
  },

  async joinCompetition(competitionId: string, userId: string) {
    try {
      const supabase = createBrowserClient();
      const data = {
        competition_id: competitionId,
        user_id: userId,
        joined_date: new Date().toISOString()
      };
      const { data: result, error } = await supabase
        .from('competition_participants')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error joining competition:', error);
      throw error;
    }
  },

  async getCompetitionParticipants(competitionId: string) {
    try {
      const supabase = createBrowserClient();
      const { data: items, error, count } = await supabase
        .from('competition_participants')
        .select('*, user_id(*)', { count: 'exact' })
        .eq('competition_id', competitionId)
        .order('rank', { ascending: true })
        .order('weight_lost', { ascending: false })
        .limit(100);

      if (error) throw error;

      return {
        page: 1,
        perPage: 100,
        totalItems: count || 0,
        totalPages: 1,
        items: items || []
      };
    } catch (error) {
      console.error('Error getting competition participants:', error);
      throw error;
    }
  },

  async getUserCompetitions(userId: string) {
    try {
      const supabase = createBrowserClient();
      const { data: items, error, count } = await supabase
        .from('competition_participants')
        .select('*, competition_id(*)', { count: 'exact' })
        .eq('user_id', userId)
        .order('joined_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        page: 1,
        perPage: 50,
        totalItems: count || 0,
        totalPages: 1,
        items: items || []
      };
    } catch (error) {
      console.error('Error getting user competitions:', error);
      throw error;
    }
  },

  async updateParticipantWeight(participantId: string, weight: number) {
    try {
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('competition_participants')
        .update({
          current_weight: weight,
          weight_lost: 0 // This should be calculated based on starting_weight
        })
        .eq('id', participantId)
        .select()
        .single();

      if (error) throw error;
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
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  async getProfile(userId: string) {
    try {
      const supabase = createBrowserClient();
      const { data: result, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }
};
