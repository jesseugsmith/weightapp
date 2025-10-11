/**
 * Helper functions for sending email notifications via Novu
 * 
 * These functions provide a clean interface to trigger email workflows
 * without exposing the Novu API details throughout your codebase.
 */

// Types for better TypeScript support
interface TriggerEmailOptions {
  workflowId: string;
  subscriberId: string;
  payload?: Record<string, any>;
}

/**
 * Trigger a Novu workflow (email notification)
 * This should be called from server-side code only (API routes, server actions)
 * 
 * @example
 * await sendEmailNotification({
 *   workflowId: 'weight-entry-logged',
 *   subscriberId: userId,
 *   payload: { weight: 180, date: '2024-01-15' }
 * });
 */
export async function sendEmailNotification({
  workflowId,
  subscriberId,
  payload = {}
}: TriggerEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const novuApiKey = process.env.NOVU_API_KEY;

    if (!novuApiKey) {
      console.error('NOVU_API_KEY not configured');
      return { success: false, error: 'Server configuration error' };
    }

    console.log(`📧 Triggering email workflow: ${workflowId} for subscriber: ${subscriberId}`);

    const response = await fetch('https://api.novu.co/v2/events/trigger', {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${novuApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId,
        to: {
          subscriberId,
        },
        payload
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Novu trigger failed:', {
        status: response.status,
        error: errorText
      });
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log('✅ Email notification triggered successfully');
    
    return { success: true };

  } catch (error) {
    console.error('❌ Error triggering email notification:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Pre-defined email notification functions for common use cases
 */
export const EmailNotifications = {
  /**
   * Send email when user logs their weight
   */
  async weightEntryLogged(
    userId: string, 
    data: { weight: number; date: string; unit?: string }
  ) {
    return sendEmailNotification({
      workflowId: 'weight-entry-logged',
      subscriberId: userId,
      payload: {
        weight: data.weight,
        date: data.date,
        unit: data.unit || 'lbs'
      }
    });
  },

  /**
   * Send daily reminder to log weight
   */
  async dailyWeightReminder(userId: string) {
    return sendEmailNotification({
      workflowId: 'daily-weight-reminder',
      subscriberId: userId,
      payload: {
        date: new Date().toISOString()
      }
    });
  },

  /**
   * Send competition standings update
   */
  async competitionStandingsUpdate(
    userId: string,
    data: {
      competitionName: string;
      competitionId: string;
      rank: number;
      totalParticipants: number;
      progressPercentage: number;
    }
  ) {
    return sendEmailNotification({
      workflowId: 'competition-standings-update',
      subscriberId: userId,
      payload: {
        competitionName: data.competitionName,
        competitionId: data.competitionId,
        rank: data.rank,
        totalParticipants: data.totalParticipants,
        progressPercentage: data.progressPercentage,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      }
    });
  },

  /**
   * Send competition invitation
   */
  async competitionInvitation(
    userId: string,
    data: {
      competitionName: string;
      competitionId: string;
      inviterName: string;
      startDate: string;
      endDate: string;
    }
  ) {
    return sendEmailNotification({
      workflowId: 'competition-invitation',
      subscriberId: userId,
      payload: {
        competitionName: data.competitionName,
        competitionId: data.competitionId,
        inviterName: data.inviterName,
        startDate: data.startDate,
        endDate: data.endDate,
        joinUrl: `${process.env.NEXT_PUBLIC_APP_URL}/competitions/${data.competitionId}/join`
      }
    });
  },

  /**
   * Send goal achieved celebration
   */
  async goalAchieved(
    userId: string,
    data: {
      goalType: string;
      achievedValue: number;
      daysToAchieve?: number;
    }
  ) {
    return sendEmailNotification({
      workflowId: 'goal-achieved',
      subscriberId: userId,
      payload: {
        goalType: data.goalType,
        achievedValue: data.achievedValue,
        daysToAchieve: data.daysToAchieve
      }
    });
  },

  /**
   * Send weekly progress report
   */
  async weeklyProgressReport(
    userId: string,
    data: {
      weekStartDate: string;
      weekEndDate: string;
      totalWeightChange: number;
      entriesLogged: number;
      competitionsActive: number;
    }
  ) {
    return sendEmailNotification({
      workflowId: 'weekly-progress-report',
      subscriberId: userId,
      payload: {
        weekStartDate: data.weekStartDate,
        weekEndDate: data.weekEndDate,
        totalWeightChange: data.totalWeightChange,
        entriesLogged: data.entriesLogged,
        competitionsActive: data.competitionsActive
      }
    });
  },
};

/**
 * Bulk send email to multiple subscribers
 * Useful for broadcasting announcements or updates
 */
export async function sendBulkEmailNotification(
  workflowId: string,
  subscriberIds: string[],
  payload: Record<string, any> = {}
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  // Send to all subscribers (can be optimized with Promise.all for large batches)
  for (const subscriberId of subscriberIds) {
    const result = await sendEmailNotification({
      workflowId,
      subscriberId,
      payload
    });

    if (!result.success) {
      errors.push(`Failed for ${subscriberId}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    errors
  };
}
