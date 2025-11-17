'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createBrowserClient } from '@/lib/supabase';
import { usePermissions } from '@/contexts/PermissionsContext';

import LoadingSpinner from '@/components/LoadingSpinner';
import type { UserRole, Role } from '@/types/supabase.types';

interface AdminUser {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  role?: Role;
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function AdminManagement() {
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();
  const { hasRole } = usePermissions();

  useEffect(() => {
    if (hasRole('super_admin')) {
      fetchAdmins();
    } else {
      setLoading(false);
    }
  }, [hasRole]);

  const fetchAdmins = async () => {
    try {
      const supabase = createBrowserClient();
      
      // First get admin and super_admin roles
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('id, name')
        .in('name', ['admin', 'super_admin']);
      
      if (rolesError) throw rolesError;
      
      const roleIds = roles?.map(r => r.id) || [];
      
      // Then get all user_roles with those role_ids
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select(`
          *,
          roles!inner(id, name, description, is_system, created_at, updated_at)
        `)
        .in('role_id', roleIds)
        .is('expires_at', null); // Only non-expired roles
      
      if (userRolesError) throw userRolesError;
      
      // Fetch profiles separately for each user_id
      const userIds = userRoles?.map(ur => ur.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }
      
      // Create a map of profiles by user_id
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      // Transform the data to match AdminUser interface
      const transformedAdmins = userRoles?.map((ur: any) => ({
        id: ur.id,
        user_id: ur.user_id,
        role_id: ur.role_id,
        assigned_by: ur.assigned_by,
        assigned_at: ur.assigned_at,
        expires_at: ur.expires_at,
        role: Array.isArray(ur.roles) ? ur.roles[0] : ur.roles,
        profile: profileMap.get(ur.user_id),
      })) || [];
      
      setAdmins(transformedAdmins);
    } catch (error) {
      console.error('Error fetching admins:', error);
      setError('Failed to fetch admin list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const supabase = createBrowserClient();

      // First, find the user by searching profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('first_name', `%${newAdminEmail}%`)
        .or(`last_name.ilike.%${newAdminEmail}%`)
        .single();
      
      let userId = profile?.id;
      
      // If not found by name, try to find by user ID directly
      if (!userId) {
        // Assume they entered a user ID
        userId = newAdminEmail;
      }

      if (!userId) {
        setError('User not found');
        return;
      }

      // Get the admin role ID
      const { data: adminRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

      if (roleError || !adminRole) {
        setError('Admin role not found in database');
        return;
      }

      // Check if user already has this role
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', adminRole.id)
        .single();

      if (existing) {
        setError('User already has admin role');
        return;
      }

      // Add the admin role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert([{
          user_id: userId,
          role_id: adminRole.id,
          assigned_by: user?.id
        }]);

      if (insertError) throw insertError;

      setSuccess('Admin role added successfully');
      setNewAdminEmail('');
      fetchAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      setError('Failed to add admin role');
    }
  };

  const handleRemoveAdmin = async (userRoleId: string) => {
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userRoleId);

      if (error) throw error;

      setSuccess('Admin role removed successfully');
      fetchAdmins();
    } catch (error) {
      console.error('Error removing admin:', error);
      setError('Failed to remove admin role');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!hasRole('super_admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center text-red-600">
            Access denied. Super admin privileges required.
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
              Admin Management
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

            <form onSubmit={handleAddAdmin} className="mt-5">
              <div className="flex gap-4">
                <input
                  type="text"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter user ID or name"
                  className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add Admin
                </button>
              </div>
            </form>

            <div className="mt-8">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Current Admins
              </h4>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Added On
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {admins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {admin.profile?.first_name} {admin.profile?.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {admin.role?.name === 'super_admin' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              Super Admin
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              Admin
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(admin.assigned_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {admin.role?.name === 'admin' && (
                            <button
                              onClick={() => handleRemoveAdmin(admin.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          )}
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
  );
}
