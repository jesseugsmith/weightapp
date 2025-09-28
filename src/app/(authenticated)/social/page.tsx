'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { Friend } from '@/types/database.types';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Social() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchFriendRequests();
    }
  }, [user]);

  const fetchFriends = async () => {
    try {
      // First get friends
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error in friends query:', error);
        throw error;
      }

      // Then get their profiles
      if (data && data.length > 0) {
        const friendIds = data.map(friend => friend.friend_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', friendIds);

        if (profileError) {
          console.error('Error in profiles query:', profileError);
          throw profileError;
        }

        // Match profiles with friends
        const friendsWithProfiles = data.map(friend => ({
          ...friend,
          friend_profile: profiles?.find(p => p.id === friend.friend_id)
        }));

        setFriends(friendsWithProfiles);
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', {
        error,
        user_id: user?.id,
        query: `friends?select=id,user_id,friend_id,status,created_at,friend_profile:profiles!friend_id(id,email)&user_id=eq.${user?.id}&status=eq.accepted`
      });
    }
  };

  const fetchFriendRequests = async () => {
    try {
      // First get friend requests
      const { data, error } = await supabase
        .from('friends')
        .select('*')
        .eq('friend_id', user?.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error in friend requests query:', error);
        throw error;
      }

      // Then get requesters' profiles
      if (data && data.length > 0) {
        const requesterIds = data.map(request => request.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', requesterIds);

        if (profileError) {
          console.error('Error in profiles query:', profileError);
          throw profileError;
        }

        // Match profiles with requests
        const requestsWithProfiles = data.map(request => ({
          ...request,
          user_profile: profiles?.find(p => p.id === request.user_id)
        }));

        setFriendRequests(requestsWithProfiles);
      } else {
        setFriendRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', {
        error,
        friend_id: user?.id,
        query: `friends?select=id,user_id,friend_id,status,created_at,user_profile:profiles!user_id(id,email)&friend_id=eq.${user?.id}&status=eq.pending`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSearchError('');
      
      // First, find the user by email
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail)
        .single();

      if (userError || !users) {
        setSearchError('User not found');
        return;
      }

      if (users.id === user.id) {
        setSearchError('You cannot add yourself as a friend');
        return;
      }

      // Check if friend request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('friends')
        .select('*')
        .or('and(user_id.eq.' + user.id + ',friend_id.eq.' + users.id + '),and(user_id.eq.' + users.id + ',friend_id.eq.' + user.id + ')');

      if (checkError) throw checkError;

      if (existingRequest && existingRequest.length > 0) {
        setSearchError('Friend request already exists');
        return;
      }

      // Create friend request
      const { error: requestError } = await supabase
        .from('friends')
        .insert([
          {
            user_id: user.id,
            friend_id: users.id,
            status: 'pending',
          },
        ]);

      if (requestError) throw requestError;

      setSearchEmail('');
      alert('Friend request sent!');
    } catch (error) {
      console.error('Error adding friend:', error);
      setSearchError('Error sending friend request');
    }
  };

  const handleFriendRequest = async (requestId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status })
        .eq('id', requestId);

      if (error) throw error;

      fetchFriendRequests();
      if (status === 'accepted') {
        fetchFriends();
      }
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading your social network..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Add Friend Section */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Add Friend</h2>
          <form onSubmit={handleAddFriend} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Friend&apos;s Email
              </label>
              <input
                type="email"
                id="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Enter email address"
              />
            </div>
            {searchError && (
              <p className="text-red-500 text-sm">{searchError}</p>
            )}
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Send Friend Request
            </button>
          </form>
        </div>

        {/* Friend Requests Section */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Friend Requests</h2>
          {friendRequests.length === 0 ? (
            <p className="text-gray-500">No pending friend requests</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {friendRequests.map((request) => (
                <li key={request.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {request.user_profile?.email}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFriendRequest(request.id, 'accepted')}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFriendRequest(request.id, 'declined')}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Friends List Section */}
        <div className="bg-white shadow sm:rounded-lg p-6 md:col-span-2">
          <h2 className="text-lg font-medium mb-4">My Friends</h2>
          {friends.length === 0 ? (
            <p className="text-gray-500">No friends yet</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {friends.map((friend) => (
                <li key={friend.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {friend.friend_profile?.email}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
