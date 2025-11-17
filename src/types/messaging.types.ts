// ============================================================================
// COMPETITION MESSAGING TYPES
// ============================================================================

export interface CompetitionMessage {
  id: string;
  competition_id: string;
  user_id: string;
  message: string;
  parent_message_id?: string;
  type: 'message' | 'announcement' | 'system';
  mentioned_users: string[];
  attachments: MessageAttachment[];
  edited_at?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
  };
  reactions?: MessageReaction[];
  reply_count?: number;
  replies?: CompetitionMessage[];
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  url: string;
  filename: string;
  size?: number;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  
  // Joined data
  user?: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
  };
}

export interface MessageReadReceipt {
  id: string;
  competition_id: string;
  user_id: string;
  last_read_message_id?: string;
  last_read_at: string;
  updated_at: string;
}

export interface CompetitionMessageCreate {
  competition_id: string;
  message: string;
  parent_message_id?: string;
  type?: 'message' | 'announcement' | 'system';
  attachments?: MessageAttachment[];
}

export interface CompetitionMessageUpdate {
  message?: string;
  edited_at?: string;
  deleted_at?: string;
}

export interface MessageReactionCreate {
  message_id: string;
  emoji: string;
}

export interface CompetitionMessaging {
  messages: CompetitionMessage[];
  unread_count: number;
  last_read_at?: string;
  participants: {
    id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    is_online?: boolean;
  }[];
}

// Message pagination
export interface MessagePage {
  messages: CompetitionMessage[];
  has_more: boolean;
  cursor?: string;
}

// Real-time message events
export interface MessageEvent {
  type: 'message_created' | 'message_updated' | 'message_deleted' | 'reaction_added' | 'reaction_removed' | 'user_typing';
  competition_id: string;
  message?: CompetitionMessage;
  reaction?: MessageReaction;
  user_id?: string;
  timestamp: string;
}

// Typing indicator
export interface TypingUser {
  user_id: string;
  user_name: string;
  started_at: string;
}

export interface CompetitionTyping {
  competition_id: string;
  typing_users: TypingUser[];
}