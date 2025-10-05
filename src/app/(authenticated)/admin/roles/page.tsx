'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { pb } from '@/lib/pocketbase';
import { usePermissions } from '@/contexts/PermissionContext';

import LoadingSpinner from '@/components/LoadingSpinner';
import { Role, Permission, UserRole, User } from '@/types/database.types';

interface UserWithRoles {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
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
  const { hasPermission } = usePermissions();

  useEffect(() => {
    if (hasPermission('manage_roles')) {
      fetchRolesAndPermissions();
      fetchUsers();
    } else {
      setError('You do not have permission to manage roles');
      setLoading(false);
    }
  }, [hasPermission]);

  const fetchRolesAndPermissions = async () => {
    try {
      // Fetch roles with their permissions
      const rolesData = await pb.collection('roles').getFullList({
        expand: 'role_permissions_via_role_id.permission_id',
        sort: 'name'
      });
      setRoles(rolesData as Role[]);

      // Fetch all permissions
      const permsData = await pb.collection('permissions').getFullList({
        sort: 'name'
      });
      setPermissions(permsData as Permission[]);
    } catch (error) {
      console.error('Error fetching roles and permissions:', error);
      setError('Failed to fetch roles and permissions');
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all users
      const usersData = await pb.collection('users').getFullList({
        sort: 'email'
      });

      // Fetch user roles with expansions
      const userRolesData = await pb.collection('user_roles').getFullList({
        expand: 'role_id'
      });

      // Fetch profiles to get first_name and last_name
      const profilesData = await pb.collection('profiles').getFullList();
      const profilesMap = new Map(profilesData.map(p => [p.user_id, p]));

      // Group roles by user
      const rolesByUser = new Map<string, Role[]>();
      userRolesData.forEach((userRole: any) => {
        const userId = userRole.user_id;
        const role = userRole.expand?.role_id;
        if (role) {
          if (!rolesByUser.has(userId)) {
            rolesByUser.set(userId, []);
          }
          rolesByUser.get(userId)!.push(role);
        }
      });

      // Combine users with their roles
      const usersWithRoles: UserWithRoles[] = usersData.map((u: any) => {
        const profile = profilesMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          roles: rolesByUser.get(u.id) || []
        };
      });

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
      // Find the role by name
      const role = roles.find(r => r.name === selectedRole);
      if (!role) {
        setError('Role not found');
        return;
      }

      // Check if user already has this role
      const existingUserRole = await pb.collection('user_roles').getFirstListItem(
        `user_id = "${selectedUser}" && role_id = "${role.id}"`
      ).catch(() => null);

      if (existingUserRole) {
        setError('User already has this role');
        return;
      }

      // Create the user role
      await pb.collection('user_roles').create({
        user_id: selectedUser,
        role_id: role.id,
        assigned_by: user?.id,
        assigned_at: new Date().toISOString()
      });

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
      // Find the role by name
      const role = roles.find(r => r.name === roleName);
      if (!role) {
        setError('Role not found');
        return;
      }

      // Find and delete the user role
      const userRole = await pb.collection('user_roles').getFirstListItem(
        `user_id = "${userId}" && role_id = "${role.id}"`
      );

      if (userRole) {
        await pb.collection('user_roles').delete(userRole.id);
        setSuccess('Role removed successfully');
        fetchUsers(); // Refresh the user list
      } else {
        setError('User role not found');
      }
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
