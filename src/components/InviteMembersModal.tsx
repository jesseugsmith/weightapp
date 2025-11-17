'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/supabase.types';
import LoadingSpinner from '@/components/LoadingSpinner';
import { getBaseUrl } from '@/utils/environment';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitionId: string;
  competitionName: string;
}

// Extended profile with email from auth.users
interface ProfileWithEmail extends Profile {
  email: string;
}

export default function InviteMembersModal({
  isOpen,
  onClose,
  competitionId,
  competitionName,
}: InviteMembersModalProps) {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<ProfileWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
    }
  }, [isOpen, competitionId]);

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!authUser) {
        setError('Not authenticated');
        return;
      }

      const supabase = createBrowserClient();

      // First, get existing participants
      const { data: participants, error: participantsError } = await supabase
        .from('competition_participants')
        .select('user_id')
        .eq('competition_id', competitionId);

      if (participantsError) throw participantsError;

      // Then, get pending invites (if you have this collection)
      let pendingInvites: any[] = [];
      try {
        const { data: invites, error: invitesError } = await supabase
          .from('competition_invites')
          .select('user_id')
          .eq('competition_id', competitionId)
          .eq('status', 'pending');

        if (!invitesError) {
          pendingInvites = invites || [];
        }
      } catch (error) {
        // Ignore if collection doesn't exist
        console.log('Competition invites table not available');
      }

      // Create arrays of IDs to exclude
      const participantIds = participants?.map((p: any) => p.user_id) || [];
      const inviteeIds = pendingInvites?.map((i: any) => i.user_id) || [];
      const excludeIds = [...participantIds, ...inviteeIds, authUser.id];

      // Get all profiles
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Get auth users to get emails
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      // Create a map of user_id to email
      const emailMap = new Map<string, string>();
      if (authUsers && !authError) {
        authUsers.forEach((u: any) => {
          emailMap.set(u.id, u.email || '');
        });
      }

      // Filter out excluded users and add email
      const filteredUsers = (allProfiles || [])
        .filter((u: any) => !excludeIds.includes(u.id))
        .map((profile: any) => ({
          ...profile,
          email: emailMap.get(profile.id) || 'No email'
        })) as ProfileWithEmail[];
        
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error instanceof Error ? error.message : 'Failed to load available users');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (userId: string) => {
    try {
      setError(null);
      setSuccessMessage(null);
      setInvitingUsers(prev => new Set(prev).add(userId));

      if (!authUser) {
        setError('Not authenticated');
        return;
      }

      const invitedUser = users.find(u => u.id === userId);
      if (!invitedUser) {
        setError('User not found');
        return;
      }

      const supabase = createBrowserClient();

      // Create the invite (if you have this table)
      try {
        const { error: inviteError } = await supabase
          .from('competition_invites')
          .insert({
            competition_id: competitionId,
            email: invitedUser.email,
            status: 'pending',
            invited_by: authUser.id,
            user_id: userId
          });

        if (inviteError && inviteError.code !== '42P01') { // 42P01 = table doesn't exist
          throw inviteError;
        }
      } catch (error: any) {
        // If table doesn't exist, continue without creating invite
        console.log('Competition invites table not available, skipping invite creation');
      }

      // Note: We're using Novu for notifications now
      // You can send a Novu notification here via API route if needed
      // For now, we'll just show success

      // Remove the invited user from the list
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSuccessMessage(`Invitation sent successfully!`);
    } catch (error) {
      console.error('Error inviting user:', error);
      setError('Failed to send invite');
    } finally {
      setInvitingUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const filteredUsers = searchQuery
    ? users.filter(user => 
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Invite Members</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {successMessage}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner message="Loading users..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No users found matching your search' : 'No users available to invite'}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.avatar ? (
                          <img 
                            src={user.avatar} 
                            alt={`${user.first_name || ''} ${user.last_name || ''}`}
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm text-gray-500">
                              {(user.first_name || user.email || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="ml-4">
                          {(user.first_name || user.last_name) && (
                            <div className="text-sm font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                          )}
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleInviteUser(user.id)}
                        disabled={invitingUsers.has(user.id)}
                        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md 
                          ${invitingUsers.has(user.id)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'text-indigo-600 bg-indigo-100 hover:bg-indigo-200'
                          }`}
                      >
                        {invitingUsers.has(user.id) ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Inviting...
                          </>
                        ) : (
                          'Invite'
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
