'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { Role, Permission, UserRole } from '@/types/database.types';

interface UserWithRoles {
  id: string;
  email: string;
  roles: Role[];
}

export default function RoleManagement() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    checkAdminAccess();
    fetchRolesAndPermissions();
    fetchUsers();
  }, []);

  const checkAdminAccess = async () => {
    const { data: hasAccess, error } = await supabase.rpc('has_permission', {
      permission_name: 'manage_roles'
    });

    if (error || !hasAccess) {
      setError('You do not have permission to manage roles');
      setLoading(false);
      return;
    }
  };

  const fetchRolesAndPermissions = async () => {
    try {
      // Fetch roles with their permissions
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select(`
          *,
          role_permissions (
            permissions (*)
          )
        `)
        .order('name');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Fetch all permissions
      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('*')
        .order('name');

      if (permsError) throw permsError;
      setPermissions(permsData || []);
    } catch (error) {
      console.error('Error fetching roles and permissions:', error);
      setError('Failed to fetch roles and permissions');
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch users with their roles from the role_management view
      const { data: userData, error: userError } = await supabase
        .from('role_management')
        .select('*');

      if (userError) throw userError;

      const usersWithRoles = (userData || []).map(u => ({
        id: u.user_id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        roles: (u.roles || []).filter(Boolean).map(roleName => ({
          id: roleName, // Using role name as ID since we don't have the role ID in the view
          name: roleName
        }))
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) return;

    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.rpc('assign_role', {
        user_id_param: selectedUser,
        role_name: selectedRole
      });

      if (error) throw error;

      setSuccess('Role assigned successfully');
      fetchUsers(); // Refresh the user list
      setSelectedUser(null);
      setSelectedRole(null);
    } catch (error) {
      console.error('Error assigning role:', error);
      setError('Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, roleName: string) => {
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.rpc('remove_role', {
        user_id_param: userId,
        role_name: roleName
      });

      if (error) throw error;

      setSuccess('Role removed successfully');
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error removing role:', error);
      setError('Failed to remove role');
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
            <h2 className="text-lg font-medium text-gray-900">Role Management</h2>
            
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

            <div className="mt-5 border-t border-gray-200">
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900">Assign Role</h3>
                <div className="mt-4 flex gap-4">
                  <select
                    value={selectedUser || ''}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select User</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedRole || ''}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select Role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.name}>
                        {role.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleAssignRole}
                    disabled={!selectedUser || !selectedRole}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
                  >
                    Assign Role
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-md font-medium text-gray-900 mb-4">User Roles</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Roles
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              {user.first_name && user.last_name ? (
                                <>
                                  <div>{`${user.first_name} ${user.last_name}`}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </>
                              ) : (
                                user.email
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex flex-wrap gap-2">
                              {user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end gap-2">
                              {user.roles.map((role) => (
                                <button
                                  key={role.id}
                                  onClick={() => handleRemoveRole(user.id, role.name)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Remove {role.name}
                                </button>
                              ))}
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
      </div>
    </div>
  );
}
