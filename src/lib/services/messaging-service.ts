import { createBrowserClient } from '@/lib/supabase';
import type {
  CompetitionMessage,
  CompetitionMessageCreate,
  CompetitionMessageUpdate,
  MessageEvent,
  MessagePage,
  MessageReaction,
  MessageReactionCreate,
  TypingUser
} from '@/types/messaging.types';

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
 * Competition Messaging Service - Handles chat/messaging functionality for competitions
 */
export class MessagingService {
  private static supabase = createBrowserClient();

  /**
   * Get messages for a competition with pagination
   */
  static async getCompetitionMessages(
    competitionId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<ApiResponse<MessagePage>> {
    try {
      // First get the basic messages
      let messageQuery = this.supabase
        .from('competition_messages')
        .select('*')
        .eq('competition_id', competitionId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        messageQuery = messageQuery.lt('created_at', cursor);
      }

      const { data: messages, error: messagesError } = await messageQuery;

      if (messagesError) {
        return createApiResponse(null as any, messagesError);
      }

      if (!messages || messages.length === 0) {
        return createApiResponse({
          messages: [],
          has_more: false,
          cursor: undefined
        }, null);
      }

      // Get user profiles for message authors
      const userIds = [...new Set(messages.map(m => m.user_id))];
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', userIds);

      // Get reactions for these messages
      const messageIds = messages.map(m => m.id);
      const { data: reactions } = await this.supabase
        .from('message_reactions')
        .select('id, message_id, user_id, emoji, created_at')
        .in('message_id', messageIds);

      // Get profiles for reaction users
      const reactionUserIds = [...new Set((reactions || []).map(r => r.user_id))];
      const { data: reactionProfiles } = await this.supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', reactionUserIds);

      // Get reply counts
      const { data: replyCounts } = await this.supabase
        .from('competition_messages')
        .select('parent_message_id')
        .in('parent_message_id', messageIds)
        .is('deleted_at', null);

      // Combine the data
      const messagesWithData = messages.map(message => {
        const userProfile = profiles?.find(p => p.id === message.user_id);
        const messageReactions = reactions?.filter(r => r.message_id === message.id).map(reaction => ({
          ...reaction,
          user: reactionProfiles?.find(p => p.id === reaction.user_id)
        }));
        const replyCount = replyCounts?.filter(r => r.parent_message_id === message.id).length || 0;

        return {
          ...message,
          user: userProfile,
          reactions: messageReactions || [],
          reply_count: replyCount
        };
      });

      // Check if there are more messages
      const hasMore = messages.length === limit;
      const nextCursor = hasMore ? messages[messages.length - 1].created_at : undefined;

      // Reverse to show oldest first
      const sortedMessages = messagesWithData.reverse();

      return createApiResponse({
        messages: sortedMessages,
        has_more: hasMore,
        cursor: nextCursor
      }, null);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Send a new message
   */
  static async sendMessage(messageData: CompetitionMessageCreate): Promise<ApiResponse<CompetitionMessage>> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        return createApiResponse(null as any, new Error('User not authenticated'));
      }

      const { data, error } = await this.supabase
        .from('competition_messages')
        .insert([{
          ...messageData,
          user_id: user.id, // Add the current user's ID
          type: messageData.type || 'message',
          mentioned_users: messageData.message.includes('@') ? [] : [], // TODO: Extract mentions
          attachments: messageData.attachments || []
        }])
        .select()
        .single();

      if (error) {
        return createApiResponse(null as any, error);
      }

      // Get user profile for the message
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .eq('id', data.user_id)
        .single();

      const messageWithProfile = {
        ...data,
        user: profile,
        reactions: [],
        reply_count: 0
      };

      return createApiResponse(messageWithProfile, null);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Edit a message
   */
  static async editMessage(
    messageId: string, 
    updateData: CompetitionMessageUpdate
  ): Promise<ApiResponse<CompetitionMessage>> {
    try {
      const { data, error } = await this.supabase
        .from('competition_messages')
        .update({
          ...updateData,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      return createApiResponse(data, error);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Delete a message (soft delete)
   */
  static async deleteMessage(messageId: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await this.supabase
        .from('competition_messages')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      return createApiResponse(!error, error);
    } catch (error) {
      return createApiResponse(false as any, error);
    }
  }

  /**
   * Add a reaction to a message
   */
  static async addReaction(reactionData: MessageReactionCreate): Promise<ApiResponse<MessageReaction>> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        return createApiResponse(null as any, new Error('User not authenticated'));
      }

      const { data, error } = await this.supabase
        .from('message_reactions')
        .insert([{
          ...reactionData,
          user_id: user.id // Add the current user's ID
        }])
        .select()
        .single();

      return createApiResponse(data, error);
    } catch (error) {
      return createApiResponse(null as any, error);
    }
  }

  /**
   * Remove a reaction from a message
   */
  static async removeReaction(messageId: string, emoji: string): Promise<ApiResponse<boolean>> {
    try {
      // Get current user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        return createApiResponse(false, new Error('User not authenticated'));
      }

      const { error } = await this.supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('emoji', emoji)
        .eq('user_id', user.id); // Only remove the current user's reaction

      return createApiResponse(!error, error);
    } catch (error) {
      return createApiResponse(false, error);
    }
  }

  /**
   * Get unread message count for a competition
   */
  static async getUnreadCount(competitionId: string): Promise<ApiResponse<number>> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) {
        return createApiResponse(0, null);
      }

      const { data, error } = await this.supabase
        .rpc('get_unread_message_count', {
          competition_uuid: competitionId,
          user_uuid: user.user.id
        });

      return createApiResponse(data || 0, error);
    } catch (error) {
      return createApiResponse(0, error);
    }
  }

  /**
   * Mark messages as read up to a specific message
   */
  static async markAsRead(competitionId: string, messageId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user?.user) {
        return createApiResponse(false, 'User not authenticated');
      }

      const { error } = await this.supabase
        .rpc('mark_messages_as_read', {
          competition_uuid: competitionId,
          user_uuid: user.user.id,
          message_uuid: messageId
        });

      return createApiResponse(!error, error);
    } catch (error) {
      return createApiResponse(false, error);
    }
  }

  /**
   * Send typing indicator
   */
  static async sendTypingIndicator(competitionId: string): Promise<ApiResponse<boolean>> {
    try {
      // For now, we'll implement a simple typing system
      // In a full implementation, you'd use Supabase Realtime presence
      return createApiResponse(true, null);
    } catch (error) {
      return createApiResponse(false, error);
    }
  }

  /**
   * Subscribe to real-time message events
   */
  static subscribeToMessages(
    competitionId: string,
    onMessage: (event: MessageEvent) => void,
    onConnectionChange?: (connected: boolean) => void
  ): () => void {
    const channel = this.supabase.channel(`competition_messages_${competitionId}`);

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'competition_messages',
        filter: `competition_id=eq.${competitionId}`
      }, (payload) => {
        onMessage({
          type: 'message_created',
          competition_id: competitionId,
          message: payload.new as CompetitionMessage,
          timestamp: new Date().toISOString()
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'competition_messages',
        filter: `competition_id=eq.${competitionId}`
      }, (payload) => {
        onMessage({
          type: 'message_updated',
          competition_id: competitionId,
          message: payload.new as CompetitionMessage,
          timestamp: new Date().toISOString()
        });
      })
      .subscribe((status) => {
        onConnectionChange?.(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Subscribe to reaction events
   */
  static subscribeToReactions(
    competitionId: string,
    onReaction: (event: MessageEvent) => void,
    onConnectionChange?: (connected: boolean) => void
  ): () => void {
    const channel = this.supabase.channel(`message_reactions_${competitionId}`);

    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reactions'
      }, (payload) => {
        onReaction({
          type: 'reaction_added',
          competition_id: competitionId,
          reaction: payload.new as MessageReaction,
          timestamp: new Date().toISOString()
        });
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'message_reactions'
      }, (payload) => {
        onReaction({
          type: 'reaction_removed',
          competition_id: competitionId,
          reaction: payload.old as MessageReaction,
          timestamp: new Date().toISOString()
        });
      })
      .subscribe((status) => {
        onConnectionChange?.(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Subscribe to typing indicators
   */
  static subscribeToTyping(
    competitionId: string,
    onTyping: (typingUsers: TypingUser[]) => void,
    onConnectionChange?: (connected: boolean) => void
  ): () => void {
    // For now, return a no-op function
    // In a full implementation, you'd use Supabase Realtime presence
    onConnectionChange?.(true);
    return () => {};
  }
}