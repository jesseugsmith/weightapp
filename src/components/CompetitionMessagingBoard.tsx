"use client";

import { useAuth } from "@/hooks/useAuth";
import { MessagingService } from "@/lib/services/messaging-service";
import type {
  CompetitionMessage,
  CompetitionMessageCreate,
  MessageEvent,
  MessageReactionCreate,
  TypingUser
} from "@/types/messaging.types";
import { AlertTriangle, ArrowLeft, MoreHorizontal, Send, Smile, ThumbsUp, Heart, Reply, Edit, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CompetitionMessagingBoardProps {
  competitionId: string;
  competitionName?: string;
  onBack?: () => void;
}

interface MessageItemProps {
  message: CompetitionMessage;
  currentUserId: string;
  onReaction: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, newText: string) => void;
  onDelete: (messageId: string) => void;
  onReply: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUserId,
  onReaction,
  onEdit,
  onDelete,
  onReply
}) => {
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.message);

  const isOwn = message.user_id === currentUserId;
  const isDeleted = !!message.deleted_at;
  const isEdited = !!message.edited_at;

  const handleEdit = () => {
    if (editText.trim() && editText.trim() !== message.message) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this message?")) {
      onDelete(message.id);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getUserName = (user: any) => {
    if (!user) return 'Unknown User';
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Anonymous';
  };

  // Group reactions by emoji
  const groupedReactions = message.reactions?.reduce((acc: any[], reaction) => {
    const existing = acc.find(r => r.emoji === reaction.emoji);
    if (existing) {
      existing.count++;
      if (reaction.user_id === currentUserId) {
        existing.hasUserReacted = true;
      }
    } else {
      acc.push({
        emoji: reaction.emoji,
        count: 1,
        hasUserReacted: reaction.user_id === currentUserId
      });
    }
    return acc;
  }, []) || [];

  return (
    <div className={`mb-4 mx-4 flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isOwn ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-lg p-3 relative group`}>
        {/* User name (for others' messages) */}
        {!isOwn && (
          <div className="text-xs font-medium text-gray-600 mb-1">
            {getUserName(message.user)}
          </div>
        )}

        {/* Message content */}
        {isEditing ? (
          <div className="w-full">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full text-white bg-transparent border border-white rounded p-2 mb-2 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="text-white text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className={`${isDeleted ? 'italic' : ''}`}>
            {message.message}
          </div>
        )}

        {/* Timestamp and edited indicator */}
        <div className="flex items-center justify-between mt-1">
          <div className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
            {formatTime(message.created_at)}
            {isEdited && !isDeleted && ' (edited)'}
          </div>
          
          {/* Message actions button */}
          {!isDeleted && (
            <button
              onClick={() => setShowActions(!showActions)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Reactions */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {groupedReactions.map((reaction, index) => (
              <button
                key={index}
                onClick={() => onReaction(message.id, reaction.emoji)}
                className={`px-2 py-1 rounded-full text-xs ${
                  reaction.hasUserReacted 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                } transition-colors`}
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}

        {/* Message actions */}
        {showActions && !isDeleted && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border p-2 flex gap-2 z-10">
            <button
              onClick={() => onReaction(message.id, '👍')}
              className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
              title="Like"
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReaction(message.id, '❤️')}
              className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
              title="Love"
            >
              <Heart className="w-4 h-4" />
            </button>
            <button
              onClick={() => onReply(message.id)}
              className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
              title="Reply"
            >
              <Reply className="w-4 h-4" />
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 hover:bg-red-100 text-red-600 rounded flex items-center gap-1"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const useMessaging = (competitionId: string) => {
  const [messages, setMessages] = useState<CompetitionMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [isConnected, setIsConnected] = useState(false);

  const connectionStatusRef = useRef({
    messagesConnected: false,
    typingConnected: false
  });
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const typingUnsubscribeRef = useRef<(() => void) | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const TYPING_DEBOUNCE_MS = 1000;

  const updateConnectionStatus = useCallback(() => {
    const connected = connectionStatusRef.current.messagesConnected || connectionStatusRef.current.typingConnected;
    setIsConnected(connected);
  }, []);

  // Handle real-time message events
  const handleMessageEvent = useCallback((event: MessageEvent) => {
    switch (event.type) {
      case 'message_created':
        if (event.message) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === event.message!.id);
            if (exists) return prev;
            return [...prev, event.message!];
          });
        }
        break;

      case 'message_updated':
        if (event.message) {
          setMessages(prev => prev.map(msg => 
            msg.id === event.message!.id ? event.message! : msg
          ));
        }
        break;

      case 'message_deleted':
        if (event.message) {
          setMessages(prev => prev.map(msg => 
            msg.id === event.message!.id ? event.message! : msg
          ));
        }
        break;

      case 'reaction_added':
        if (event.reaction) {
          setMessages(prev => prev.map(msg => {
            if (msg.id === event.reaction!.message_id) {
              const reactions = msg.reactions || [];
              const exists = reactions.some(r => r.id === event.reaction!.id);
              if (exists) return msg;
              
              return {
                ...msg,
                reactions: [...reactions, event.reaction!]
              };
            }
            return msg;
          }));
        }
        break;

      case 'reaction_removed':
        if (event.reaction) {
          setMessages(prev => prev.map(msg => {
            if (msg.id === event.reaction!.message_id) {
              const reactions = msg.reactions || [];
              return {
                ...msg,
                reactions: reactions.filter(r => r.id !== event.reaction!.id)
              };
            }
            return msg;
          }));
        }
        break;
    }
  }, []);

  // Load messages
  const loadMessages = useCallback(async (isRefresh = false) => {
    if (loading && !isRefresh) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await MessagingService.getCompetitionMessages(
        competitionId,
        50,
        isRefresh ? undefined : cursor
      );

      if (response.success && response.data) {
        if (isRefresh) {
          setMessages(response.data.messages);
          setCursor(response.data.cursor);
        } else {
          setMessages(prev => [...prev, ...response.data!.messages]);
          setCursor(response.data.cursor);
        }
        setHasMore(response.data.has_more);
      } else {
        setError(response.error || 'Failed to load messages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [competitionId, cursor, loading]);

  // Send message
  const sendMessage = useCallback(async (message: string, parentId?: string) => {
    if (!message.trim()) return;

    try {
      const messageData: CompetitionMessageCreate = {
        competition_id: competitionId,
        message: message.trim(),
        parent_message_id: parentId
      };

      const response = await MessagingService.sendMessage(messageData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to send message');
      }

      if (response.data) {
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === response.data!.id);
          if (exists) return prev;
          return [...prev, response.data!];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      throw err;
    }
  }, [competitionId]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!newText.trim()) return;

    try {
      const response = await MessagingService.editMessage(messageId, {
        message: newText.trim()
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to edit message');
      }

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, message: newText.trim(), edited_at: new Date().toISOString() }
          : msg
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit message');
      throw err;
    }
  }, []);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const response = await MessagingService.deleteMessage(messageId);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete message');
      }

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, message: '[Message deleted]', deleted_at: new Date().toISOString() }
          : msg
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
      throw err;
    }
  }, []);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const reactionData: MessageReactionCreate = {
        message_id: messageId,
        emoji
      };

      const response = await MessagingService.addReaction(reactionData);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to add reaction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reaction');
      throw err;
    }
  }, []);

  // Remove reaction
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const response = await MessagingService.removeReaction(messageId, emoji);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to remove reaction');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove reaction');
      throw err;
    }
  }, []);

  // Send typing indicator
  const sendTyping = useCallback(async () => {
    const now = Date.now();
    
    if (now - lastTypingTimeRef.current < TYPING_DEBOUNCE_MS) {
      return;
    }
    
    lastTypingTimeRef.current = now;
    
    try {
      await MessagingService.sendTypingIndicator(competitionId);
    } catch (err) {
      console.warn('Failed to send typing indicator:', err);
    }
  }, [competitionId]);

  // Setup real-time subscriptions
  useEffect(() => {
    if (!competitionId) return;

    // Subscribe to messages
    const messageUnsubscribe = MessagingService.subscribeToMessages(
      competitionId,
      handleMessageEvent,
      (connected) => {
        connectionStatusRef.current.messagesConnected = connected;
        updateConnectionStatus();
      }
    );

    // Subscribe to typing indicators
    const typingUnsubscribe = MessagingService.subscribeToTyping(
      competitionId,
      setTypingUsers,
      (connected) => {
        connectionStatusRef.current.typingConnected = connected;
        updateConnectionStatus();
      }
    );

    unsubscribeRef.current = messageUnsubscribe;
    typingUnsubscribeRef.current = typingUnsubscribe;

    return () => {
      connectionStatusRef.current.messagesConnected = false;
      connectionStatusRef.current.typingConnected = false;
      updateConnectionStatus();
      messageUnsubscribe();
      typingUnsubscribe();
    };
  }, [competitionId, handleMessageEvent, updateConnectionStatus]);

  // Load initial data
  useEffect(() => {
    if (!competitionId) return;
    
    setMessages([]);
    setCursor(undefined);
    setHasMore(true);
    setUnreadCount(0);
    setError(null);
    setIsConnected(false);
    
    loadMessages(true);
  }, [competitionId]);

  return {
    messages,
    loading,
    error,
    hasMore,
    unreadCount,
    typingUsers,
    isConnected,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    loadMessages,
    sendTyping
  };
};

const CompetitionMessagingBoard: React.FC<CompetitionMessagingBoardProps> = ({
  competitionId,
  competitionName,
  onBack
}) => {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    loading,
    error,
    typingUsers,
    isConnected,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    sendTyping
  } = useMessaging(competitionId);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await sendMessage(newMessage.trim(), replyingTo || undefined);
      setNewMessage('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !user) return;

    const userReaction = message.reactions?.find(
      r => r.emoji === emoji && r.user_id === user.id
    );

    try {
      if (userReaction) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Failed to update reaction:', error);
    }
  };

  const handleReply = (messageId: string) => {
    setReplyingTo(messageId);
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    const typingText = typingUsers.length === 1
      ? `${typingUsers[0].user_name} is typing...`
      : `${typingUsers.length} people are typing...`;

    return (
      <div className="px-4 py-2">
        <div className="text-gray-500 text-sm italic">{typingText}</div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center p-4">
        <div className="text-gray-500">Please log in to view messages</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-blue-500 text-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1 hover:bg-blue-600 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {competitionName || 'Competition'} Chat
            </h2>
          </div>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 px-4 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-700" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {loading && messages.length === 0 && (
          <div className="flex justify-center items-center p-8">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        )}
        
        <div className="py-4">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              currentUserId={user.id}
              onReaction={handleReaction}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onReply={handleReply}
            />
          ))}
          {renderTypingIndicator()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="bg-gray-100 px-4 py-2 flex justify-between items-center border-t">
          <span className="text-gray-600 text-sm">Replying to message...</span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-blue-500 text-sm hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              if (e.target.value.length > 0) {
                sendTyping();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              newMessage.trim() 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompetitionMessagingBoard;