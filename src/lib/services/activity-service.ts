import { createBrowserClient } from '@/lib/supabase';
import type {
  ActivityEntry,
  ActivityEntryCreate,
  ActivityEntryUpdate,
} from '@/types/supabase.types';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

function createApiResponse<T>(data: T | null, error: any): ApiResponse<T> {
  return {
    data,
    error: error?.message || error || null,
    success: !error,
  };
}

/**
 * Activity Service - Handles flexible activity tracking (weight, steps, distance, etc.)
 */
export class ActivityService {
  private static supabase = createBrowserClient();

  /**
   * Create a new activity entry
   */
  static async createActivityEntry(data: ActivityEntryCreate): Promise<ApiResponse<ActivityEntry>> {
    try {
      const { data: result, error } = await this.supabase
        .from('activity_entries')
        .insert(data)
        .select()
        .single();

      return createApiResponse(result, error);
    } catch (error) {
      return createApiResponse(null, error);
    }
  }

  /**
   * Create a weight entry (convenience method)
   */
  static async createWeightEntry(
    weight: number,
    userId: string,
    date?: string,
    notes?: string,
    imageUrl?: string
  ): Promise<ApiResponse<ActivityEntry>> {
    try {
      return this.createActivityEntry({
        user_id: userId,
        activity_type: 'weight',
        value: weight,
        unit: 'lbs', // Could be made configurable based on user preference
        date: date || new Date().toISOString(),
        notes: notes || null,
        image_url: imageUrl || null,
        metadata: null,
      });
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Create a steps entry
   */
  static async createStepsEntry(
    steps: number,
    userId: string,
    date?: string,
    notes?: string,
    imageUrl?: string
  ): Promise<ApiResponse<ActivityEntry>> {
    return this.createActivityEntry({
      user_id: userId,
      activity_type: 'steps',
      value: steps,
      unit: 'steps',
      date: date || new Date().toISOString(),
      notes: notes || null,
      image_url: imageUrl || null,
      metadata: null,
    });
  }

  /**
   * Get activity entries for a user by activity type
   */
  static async getActivityEntries(
    activityType: ActivityEntry['activity_type'],
    userId?: string,
    limit: number = 50,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<ActivityEntry[]>> {
    try {
      let query = this.supabase
        .from('activity_entries')
        .select('*')
        .eq('activity_type', activityType)
        .order('date', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      return createApiResponse(data || [], error);
    } catch (error) {
      return createApiResponse([], error);
    }
  }

  /**
   * Get weight entries (backward compatibility)
   */
  static async getWeightEntries(
    userId?: string,
    limit: number = 50
  ): Promise<ApiResponse<ActivityEntry[]>> {
    return this.getActivityEntries('weight', userId, limit);
  }

  /**
   * Get latest activity entry for a user by type
   */
  static async getLatestActivityEntry(
    activityType: ActivityEntry['activity_type'],
    userId?: string
  ): Promise<ApiResponse<ActivityEntry | null>> {
    try {
      let query = this.supabase
        .from('activity_entries')
        .select('*')
        .eq('activity_type', activityType)
        .order('date', { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      return createApiResponse(data?.[0] || null, error);
    } catch (error) {
      return createApiResponse(null, error);
    }
  }

  /**
   * Update an activity entry
   */
  static async updateActivityEntry(
    id: string,
    data: ActivityEntryUpdate
  ): Promise<ApiResponse<ActivityEntry>> {
    try {
      const { data: result, error } = await this.supabase
        .from('activity_entries')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      return createApiResponse(result, error);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Delete an activity entry
   */
  static async deleteActivityEntry(id: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await this.supabase
        .from('activity_entries')
        .delete()
        .eq('id', id);

      return createApiResponse(!error, error);
    } catch (error) {
      return createApiResponse(false, error);
    }
  }

  /**
   * Get activity statistics for a date range
   */
  static async getActivityStats(
    activityType: ActivityEntry['activity_type'],
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<{
    total: number;
    average: number;
    best: number;
    count: number;
    latest: number | null;
  }>> {
    try {
      let query = this.supabase
        .from('activity_entries')
        .select('value')
        .eq('activity_type', activityType);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        return createApiResponse(null as any, error);
      }

      const values = (data || []).map((entry) => entry.value);
      const stats = {
        total: values.reduce((sum, val) => sum + val, 0),
        average: values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0,
        best: values.length > 0 ? Math.max(...values) : 0,
        count: values.length,
        latest: values.length > 0 ? values[values.length - 1] : null,
      };

      return createApiResponse(stats, null);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Get supported activity types
   */
  static getSupportedActivityTypes(): {
    type: ActivityEntry['activity_type'];
    label: string;
    unit: string;
    icon: string;
    placeholder: string;
    validate: (value: string) => { isValid: boolean; error?: string; value?: number };
  }[] {
    return [
      {
        type: 'weight',
        label: 'Weight',
        unit: 'lbs',
        icon: '⚖️',
        placeholder: 'Enter your weight',
        validate: (val: string) => {
          const num = parseFloat(val);
          return {
            isValid: !isNaN(num) && num > 0 && num <= 1000,
            error: !isNaN(num) && num > 0 && num <= 1000 ? undefined : 'Please enter a valid weight (1-1000 lbs)',
            value: num,
          };
        },
      },
      {
        type: 'steps',
        label: 'Steps',
        unit: 'steps',
        icon: '👟',
        placeholder: 'Enter step count',
        validate: (val: string) => {
          const num = parseInt(val);
          return {
            isValid: !isNaN(num) && num >= 0 && num <= 100000,
            error: !isNaN(num) && num >= 0 && num <= 100000 ? undefined : 'Please enter a valid step count (0-100,000)',
            value: num,
          };
        },
      },
      {
        type: 'body_fat',
        label: 'Body Fat',
        unit: '%',
        icon: '📊',
        placeholder: 'Enter body fat percentage',
        validate: (val: string) => {
          const num = parseFloat(val);
          return {
            isValid: !isNaN(num) && num >= 0 && num <= 100,
            error: !isNaN(num) && num >= 0 && num <= 100 ? undefined : 'Please enter a valid body fat percentage (0-100%)',
            value: num,
          };
        },
      },
      {
        type: 'muscle_mass',
        label: 'Muscle Mass',
        unit: 'lbs',
        icon: '💪',
        placeholder: 'Enter muscle mass',
        validate: (val: string) => {
          const num = parseFloat(val);
          return {
            isValid: !isNaN(num) && num > 0 && num <= 500,
            error: !isNaN(num) && num > 0 && num <= 500 ? undefined : 'Please enter a valid muscle mass (1-500 lbs)',
            value: num,
          };
        },
      },
      {
        type: 'distance',
        label: 'Distance',
        unit: 'miles',
        icon: '🏃',
        placeholder: 'Enter distance',
        validate: (val: string) => {
          const num = parseFloat(val);
          return {
            isValid: !isNaN(num) && num >= 0 && num <= 1000,
            error: !isNaN(num) && num >= 0 && num <= 1000 ? undefined : 'Please enter a valid distance (0-1000 miles)',
            value: num,
          };
        },
      },
      {
        type: 'calories',
        label: 'Calories',
        unit: 'cal',
        icon: '🔥',
        placeholder: 'Enter calories burned',
        validate: (val: string) => {
          const num = parseInt(val);
          return {
            isValid: !isNaN(num) && num >= 0 && num <= 10000,
            error: !isNaN(num) && num >= 0 && num <= 10000 ? undefined : 'Please enter valid calories (0-10,000)',
            value: num,
          };
        },
      },
    ];
  }

  /**
   * Get activity config by type
   */
  static getActivityConfig(activityType: ActivityEntry['activity_type']) {
    const supportedTypes = this.getSupportedActivityTypes();
    return supportedTypes.find((config) => config.type === activityType);
  }

  /**
   * Validate activity value based on type
   */
  static validateActivityValue(activityType: ActivityEntry['activity_type'], value: string) {
    const config = this.getActivityConfig(activityType);
    return config ? config.validate(value) : { isValid: false, error: 'Invalid activity type' };
  }
}