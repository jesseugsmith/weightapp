'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload';
import type { Role } from '@/types/database.types';

interface UserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  photo_url: string | null;
  roles: string[];
  permissions: string[];
}

interface UserDetailsModalProps {
  user: UserProfile | null;
  roles: Role[];
  onClose: () => void;
  onRoleChange: (userId: string, roleName: string, action: 'add' | 'remove') => Promise<void>;
}

function UserDetailsModal({ user, roles, onClose, onRoleChange }: UserDetailsModalProps) {
  if (!user) return null;

  const currentRole = user.roles[0] || '';

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <ProfilePhotoUpload
              userId={user.user_id}
              currentPhotoUrl={user.photo_url}
              onPhotoUpdate={(url) => {
                const updatedUsers = users.map(u => 
                  u.user_id === user.user_id ? { ...u, photo_url: url } : u
                );
                setUsers(updatedUsers);
                setSelectedUser(prev => prev ? { ...prev, photo_url: url } : null);
              }}
              size="lg"
              className="mr-4"
            />
            <h2 className="text-xl font-semibold">{user.first_name} {user.last_name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Email</h3>
            <p className="mt-1">{user.email}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Profile Information</h3>
            <div className="mt-1 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">First Name</p>
                <p>{user.first_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Last Name</p>
                <p>{user.last_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nickname</p>
                <p>{user.nickname || 'Not set'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Role</h3>
            <div className="mt-2">
              <select
                value={currentRole}
                onChange={(e) => {
                  if (currentRole) {
                    onRoleChange(user.user_id, currentRole, 'remove').then(() => {
                      if (e.target.value) {
                        onRoleChange(user.user_id, e.target.value, 'add');
                      }
                    });
                  } else if (e.target.value) {
                    onRoleChange(user.user_id, e.target.value, 'add');
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">No Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
              {roles.find(r => r.name === currentRole)?.description && (
                <p className="mt-2 text-sm text-gray-500">
                  {roles.find(r => r.name === currentRole)?.description}
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500">Current Permissions</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {user.permissions.map((permission) => (
                <span 
                  key={permission}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    checkAccess();
    fetchData();
  }, []);

  const checkAccess = async () => {
    const { data: hasAccess, error } = await supabase.rpc('has_permission', {
      permission_name: 'manage_users'
    });

    if (error || !hasAccess) {
      setError('You do not have permission to manage users');
      setLoading(false);
      return;
    }
  };

  const fetchData = async () => {
    try {
      // Fetch all users with their roles and permissions from the role_management view
      const { data: userData, error: userError } = await supabase
        .from('role_management')
        .select('*')
        .order('email');

      if (userError) throw userError;
      setUsers(userData || []);

      // Fetch all available roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch users and roles');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleName: string, action: 'add' | 'remove') => {
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.rpc(
        action === 'add' ? 'assign_role' : 'remove_role',
        {
          user_id_param: userId,
          role_name: roleName
        }
      );

      if (error) throw error;

      setSuccess(`Role ${action === 'add' ? 'assigned' : 'removed'} successfully`);
      await fetchData();
      
      // Update the selected user if they're currently being viewed
      if (selectedUser?.user_id === userId) {
        const updatedUser = users.find(u => u.user_id === userId);
        if (updatedUser) setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error(`Error ${action === 'add' ? 'assigning' : 'removing'} role:`, error);
      setError(`Failed to ${action === 'add' ? 'assign' : 'remove'} role`);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900">User Management</h2>
            
            {error && (
              <div className="mt-4 bg-red-50 p-4 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mt-4 bg-green-50 p-4 rounded-md">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <div className="mt-8">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roles
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <ProfilePhotoUpload
                                userId={user.user_id}
                                currentPhotoUrl={user.photo_url}
                                onPhotoUpdate={(url) => {
                                  const updatedUsers = users.map(u => 
                                    u.user_id === user.user_id ? { ...u, photo_url: url } : u
                                  );
                                  setUsers(updatedUsers);
                                }}
                                size="sm"
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.first_name} {user.last_name}
                              </div>
                              {user.nickname && (
                                <div className="text-sm text-gray-500">
                                  {user.nickname}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-2">
                            {user.roles[0] ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {user.roles[0]}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">No role assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Manage
                          </button>
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

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          roles={roles}
          onClose={() => setSelectedUser(null)}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}
