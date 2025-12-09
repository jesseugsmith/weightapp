import { Novu } from '@novu/api';

/**
 * Server-side Novu Service for Next.js
 * Handles subscriber management and workflow triggers
 * 
 * Security: API key is kept server-side only
 * Uses @novu/api SDK: https://docs.novu.co/platform/sdks/server/typescript
 */

const novuApiKey = process.env.NOVU_API_KEY;
const novuBackendUrl = process.env.NEXT_PUBLIC_NOVU_BACKEND_URL;

if (!novuApiKey) {
  console.warn('NOVU_API_KEY not configured - notification features will be disabled');
}

// Initialize Novu client (server-side only)
const novuClient = novuApiKey ? new Novu({
  secretKey: novuApiKey,
  ...(novuBackendUrl && { serverURL: novuBackendUrl }),
}) : null;

export class NovuService {
  /**
   * Get Novu client instance
   */
  private static getClient(): Novu {
    if (!novuClient) {
      throw new Error('Novu client not initialized. Check NOVU_API_KEY environment variable.');
    }
    return novuClient;
  }

  /**
   * Fallback: Create subscriber via direct REST API call
   * Used when SDK validation fails (common in Vercel builds)
   */
  private static async createSubscriberViaAPI(
    subscriberId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
    avatar?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const apiKey = process.env.NOVU_API_KEY;
      if (!apiKey) {
        return { success: false, error: 'NOVU_API_KEY not configured' };
      }

      const novuApiUrl = process.env.NEXT_PUBLIC_NOVU_BACKEND_URL || 'https://api.novu.co';
      // Correct endpoint: PUT /v1/subscribers/{subscriberId}
      const url = `${novuApiUrl}/v1/subscribers/${subscriberId}`;

      console.log('🔔 Making direct API call to:', url);

      const response = await fetch(url, {
        method: 'PUT', // PUT creates or updates
        headers: {
          'Authorization': `ApiKey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberId,
          email,
          firstName,
          lastName,
          phone,
          avatar,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Novu API error:', response.status, errorText);
        return {
          success: false,
          error: `Novu API error: ${response.status} ${errorText}`,
        };
      }

      console.log('✅ Subscriber created/updated via direct API call:', subscriberId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error in direct API call:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Register or update a subscriber
   * Note: create() will update if subscriber already exists
   */
  static async identifySubscriber(
    subscriberId: string,
    email?: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
    avatar?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      console.log('🔔 Calling Novu API to create/update subscriber:', {
        subscriberId,
        hasEmail: !!email,
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
        hasPhone: !!phone,
      });

      // Try the SDK call, but catch validation errors specifically
      try {
        await novu.subscribers.create({
          subscriberId,
          email,
          firstName,
          lastName,
          phone,
          avatar,
        });

        console.log('✅ Subscriber created/updated in Novu:', subscriberId);
        return { success: true };
      } catch (sdkError: any) {
        // Handle SDK validation errors (common in Vercel builds)
        if (sdkError?.name === 'SDKValidationError' || 
            (sdkError?.message?.includes('_zod') || sdkError?.message?.includes('validation failed'))) {
          console.warn('⚠️ Novu SDK validation error (likely a bundling issue on Vercel)');
          console.warn('⚠️ Attempting direct API call as fallback...');
          
          // Fallback: Use direct REST API call
          return await this.createSubscriberViaAPI(subscriberId, email, firstName, lastName, phone, avatar);
        }
        throw sdkError; // Re-throw if it's not a validation error
      }
    } catch (error) {
      // Handle SDK validation errors - these often mean the API call succeeded
      // but the SDK's response validation failed (known issue with some Novu SDK versions)
      if (error instanceof Error && error.name === 'SDKValidationError') {
        console.warn('⚠️ Novu SDK validation error (API call may have succeeded):', error.message);
        // Check if we can determine success from the error
        const errorMessage = error.message.toLowerCase();
        // If it's just a validation error and not an actual API error, assume success
        if (errorMessage.includes('response validation failed') && !errorMessage.includes('not found') && !errorMessage.includes('unauthorized')) {
          console.log('✅ Assuming subscriber was created despite validation error');
          return { success: true };
        }
      }

      console.error('❌ Error creating/updating subscriber:', error);
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        // Try to extract more details if it's an API error
        response: (error as any)?.response ? JSON.stringify((error as any).response) : undefined,
        status: (error as any)?.status,
        statusText: (error as any)?.statusText,
        rawValue: (error as any)?.rawValue,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Update subscriber information
   */
  static async updateSubscriber(
    subscriberId: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      await novu.subscribers.patch({
        ...data,
      }, subscriberId);

      console.log('✅ Subscriber updated in Novu:', subscriberId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating subscriber:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Delete a subscriber
   */
  static async deleteSubscriber(subscriberId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      await novu.subscribers.delete(subscriberId);

      console.log('✅ Subscriber deleted from Novu:', subscriberId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting subscriber:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Set subscriber credentials (push token)
   * Supports Expo, FCM, APNS, and other push providers
   */
  static async setCredentials(
    subscriberId: string,
    providerId: string,
    credentials: {
      deviceTokens?: string[];
      webhookUrl?: string;
    },
    integrationIdentifier?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      // For Expo provider, we may need integrationIdentifier
      // Try append first (works for most providers)
      try {
        await novu.subscribers.credentials.append({
          providerId: providerId as any, // Provider ID: 'expo', 'fcm', 'apns', etc.
          ...(integrationIdentifier && { integrationIdentifier }),
          credentials,
        }, subscriberId);

        console.log('✅ Push credentials set for subscriber:', subscriberId);
        return { success: true };
      } catch (appendError) {
        // If append fails, try update (some providers require update)
        console.log('⚠️ Append failed, trying update method...');
        await novu.subscribers.credentials.update({
          providerId: providerId as any,
          ...(integrationIdentifier && { integrationIdentifier }),
          credentials,
        }, subscriberId);

        console.log('✅ Push credentials updated for subscriber:', subscriberId);
        return { success: true };
      }
    } catch (error) {
      console.error('❌ Error setting credentials:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Trigger a workflow
   */
  static async triggerWorkflow(
    workflowId: string,
    subscriberId: string,
    payload: Record<string, any>,
    overrides?: {
      email?: Record<string, any>;
      sms?: Record<string, any>;
      inApp?: Record<string, any>;
      push?: Record<string, any>;
    }
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const novu = this.getClient();

      const result = await novu.trigger({
        workflowId,
        to: {
          subscriberId,
        },
        payload,
        overrides,
      });

      console.log('✅ Workflow triggered:', workflowId, 'for subscriber:', subscriberId);
      // Transaction ID may be in result.data or result.body depending on API version
      const transactionId = (result as any).transactionId || (result as any).data?.transactionId;
      return {
        success: true,
        transactionId,
      };
    } catch (error) {
      console.error('❌ Error triggering workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Trigger workflow for multiple subscribers
   */
  static async triggerBulk(
    workflowId: string,
    subscribers: string[],
    payload: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      await novu.triggerBulk({
        events: subscribers.map((subscriberId) => ({
          workflowId,
          to: { subscriberId },
          payload,
        })),
      });

      console.log('✅ Bulk workflow triggered:', workflowId, 'for', subscribers.length, 'subscribers');
      return { success: true };
    } catch (error) {
      console.error('❌ Error triggering bulk workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Cancel a triggered workflow
   */
  static async cancelWorkflow(transactionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      await novu.cancel(transactionId);

      console.log('✅ Workflow cancelled:', transactionId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error cancelling workflow:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Get subscriber preferences
   */
  static async getPreferences(subscriberId: string): Promise<any> {
    try {
      const novu = this.getClient();

      const prefs = await novu.subscribers.preferences.list(subscriberId);

      return prefs;
    } catch (error) {
      console.error('❌ Error getting preferences:', error);
      return null;
    }
  }

  /**
   * Update subscriber preferences for a workflow
   */
  static async updatePreferences(
    subscriberId: string,
    templateId: string,
    channelPreferences: {
      email?: boolean;
      sms?: boolean;
      inApp?: boolean;
      push?: boolean;
      chat?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const novu = this.getClient();

      await novu.subscribers.preferences.update({
        workflowId: templateId,
        channels: channelPreferences,
      }, subscriberId);

      console.log('✅ Preferences updated for subscriber:', subscriberId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating preferences:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      };
    }
  }

  /**
   * Get notification feed for a subscriber
   */
  static async getNotificationsFeed(
    subscriberId: string,
    page: number = 0,
    limit: number = 10
  ): Promise<any> {
    try {
      const novu = this.getClient();

      const feed = await novu.subscribers.notifications.feed({
        subscriberId,
        page,
        limit,
      });

      return feed;
    } catch (error) {
      console.error('❌ Error getting notifications feed:', error);
      return null;
    }
  }

  /**
   * Mark notification as seen
   * Note: This method needs to be implemented based on actual API structure
   * TODO: Check Novu API documentation for correct method signature
   */
  static async markNotificationAsSeen(
    subscriberId: string,
    messageId: string
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement based on actual Novu API structure
    console.warn('markNotificationAsSeen not yet implemented');
    return { success: false, error: 'Not implemented' };
  }

  /**
   * Mark notification as read
   * Note: This method needs to be implemented based on actual API structure
   * TODO: Check Novu API documentation for correct method signature
   */
  static async markNotificationAsRead(
    subscriberId: string,
    messageId: string
  ): Promise<{ success: boolean; error?: string }> {
    // TODO: Implement based on actual Novu API structure
    console.warn('markNotificationAsRead not yet implemented');
    return { success: false, error: 'Not implemented' };
  }
}

