'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useauth';
import LoadingSpinner from '@/components/LoadingSpinner';


interface InviteToken {
  id: string;
  token: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

export default function AdminInvites() {
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    checkAdminStatus();
    fetchTokens();
  }, []);

  const checkAdminStatus = async () => {
    const { data: isAdmin, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('Error checking admin status:', error);
      return;
    }
    setIsAdmin(isAdmin);
    setLoading(false);
  };

  const fetchTokens = async () => {
    const { data, error } = await supabase
      .from('signup_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tokens:', error);
      return;
    }

    setTokens(data || []);
  };

  const handleCreateInvite = async () => {
    setError('');
    setSuccess('');
    setCreating(true);

    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invite');
      }

      setSuccess('Invite link created successfully!');
      await navigator.clipboard.writeText(data.url);
      setSuccess('Invite link created and copied to clipboard! Expires in 48 hours.');
      fetchTokens(); // Refresh the list
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create invite');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center text-red-600">
            Access denied. Admin privileges required.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Create New Invite
            </h3>
            
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            
            {success && (
              <div className="mt-4 rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-700">{success}</div>
              </div>
            )}

            <div className="mt-5">
              <button
                onClick={handleCreateInvite}
                disabled={creating}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                  ${creating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                {creating ? 'Creating...' : 'Generate Invite Link'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Active Invites
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expires
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tokens.map((token) => (
                    <tr key={token.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(token.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(token.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {token.used_at ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Used
                          </span>
                        ) : new Date(token.expires_at) < new Date() ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Expired
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          {!token.used_at && new Date(token.expires_at) >= new Date() && (
                            <button
                              onClick={() => {
                                const url = `${window.location.origin}/signup?token=${token.token}`;
                                navigator.clipboard.writeText(url);
                                setSuccess('Invite link copied to clipboard!');
                                setTimeout(() => setSuccess(''), 3000);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Copy Link
                            </button>
                          )}
                          {!token.used_at && (
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this invite?')) {
                                  const { error } = await supabase
                                    .from('signup_tokens')
                                    .delete()
                                    .eq('id', token.id);
                                  
                                  if (error) {
                                    setError('Failed to delete invite');
                                  } else {
                                    fetchTokens();
                                    setSuccess('Invite deleted successfully');
                                    setTimeout(() => setSuccess(''), 3000);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
