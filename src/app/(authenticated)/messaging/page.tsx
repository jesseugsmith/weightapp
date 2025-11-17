"use client";

import { useAuth } from "@/hooks/useAuth";
import { MessagingService } from "@/lib/services/messaging-service";
import { createBrowserClient } from "@/lib/supabase";
import type { Competition } from "@/types/supabase.types";
import { MessageCircle, Users, Calendar, Trophy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface CompetitionChat {
  id: string;
  name: string;
  description: string | null;
  status: string;
  participant_count: number;
  unread_count: number;
  last_message?: {
    message: string;
    user_name: string;
    created_at: string;
  } | null;
  start_date: string;
  end_date: string;
}

const MessagingPage = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<CompetitionChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserChats = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserClient();

      // Get competitions user is participating in
      const { data: participations, error: participationsError } = await supabase
        .from('competition_participants')
        .select(`
          competition_id,
          competitions (
            id,
            name,
            description,
            status,
            start_date,
            end_date
          )
        `)
        .eq('user_id', user.id);

      if (participationsError) throw participationsError;

      if (!participations || participations.length === 0) {
        setChats([]);
        return;
      }

      // Get participant counts and recent messages for each competition
      const chatPromises = participations.map(async (participation) => {
        const competition = participation.competitions as any; // Single competition object
        
        // Get participant count
        const { data: participants, error: participantsError } = await supabase
          .from('competition_participants')
          .select('id')
          .eq('competition_id', competition.id);

        if (participantsError) {
          console.warn('Failed to get participant count:', participantsError);
        }

        // Get unread count
        let unreadCount = 0;
        try {
          const unreadResponse = await MessagingService.getUnreadCount(competition.id);
          if (unreadResponse.success) {
            unreadCount = unreadResponse.data || 0;
          }
        } catch (err) {
          console.warn('Failed to get unread count:', err);
        }

        // Get last message
        const { data: lastMessage, error: lastMessageError } = await supabase
          .from('competition_messages')
          .select(`
            message,
            created_at,
            user:user_id (
              id,
              profiles (
                first_name,
                last_name
              )
            )
          `)
          .eq('competition_id', competition.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let lastMessageData = null;
        if (!lastMessageError && lastMessage) {
          const userProfile = (lastMessage.user as any)?.profiles;
          const userName = userProfile 
            ? [userProfile.first_name, userProfile.last_name].filter(Boolean).join(' ') || 'Anonymous'
            : 'Unknown User';

          lastMessageData = {
            message: lastMessage.message,
            user_name: userName,
            created_at: lastMessage.created_at
          };
        }

        return {
          id: competition.id,
          name: competition.name,
          description: competition.description,
          status: competition.status,
          participant_count: participants?.length || 0,
          unread_count: unreadCount,
          last_message: lastMessageData,
          start_date: competition.start_date,
          end_date: competition.end_date
        };
      });

      const chatResults = await Promise.all(chatPromises);
      
      // Sort by unread count (unread first), then by last message time
      chatResults.sort((a, b) => {
        // Unread messages first
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        
        // Then by last message time (most recent first)
        if (a.last_message && b.last_message) {
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        }
        if (a.last_message && !b.last_message) return -1;
        if (!a.last_message && b.last_message) return 1;
        
        // Finally by competition name
        return a.name.localeCompare(b.name);
      });

      setChats(chatResults);
    } catch (err) {
      console.error('Error loading user chats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserChats();
  }, [loadUserChats]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'started':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'started':
        return <Trophy className="w-4 h-4" />;
      case 'completed':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex justify-center items-center p-8">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600">Please log in to view your messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        </div>
        <p className="text-gray-600">Stay connected with your competition teammates</p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading your chats...</span>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-800 font-medium mb-2">Error Loading Chats</div>
          <div className="text-red-600 text-sm mb-4">{error}</div>
          <button
            onClick={loadUserChats}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : chats.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Chats Yet</h2>
          <p className="text-gray-600 mb-6">Join a competition to start chatting with other participants</p>
          <Link
            href="/competitions"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Competitions
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {chats.map((chat) => (
            <Link
              key={chat.id}
              href={`/competitions/${chat.id}`}
              className="block bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Chat Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {chat.name}
                      </h3>
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(chat.status)}`}>
                        {getStatusIcon(chat.status)}
                        {chat.status.charAt(0).toUpperCase() + chat.status.slice(1)}
                      </div>
                      {chat.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
                          {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Competition Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{chat.participant_count} participant{chat.participant_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(chat.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} - {new Date(chat.end_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Last Message */}
                    {chat.last_message ? (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 mb-1">
                              {chat.last_message.user_name}
                            </div>
                            <div className="text-sm text-gray-600 line-clamp-2">
                              {chat.last_message.message}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTime(chat.last_message.created_at)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No messages yet - be the first to start the conversation!
                      </div>
                    )}
                  </div>

                  {/* Chat Icon */}
                  <div className="ml-4 flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagingPage;