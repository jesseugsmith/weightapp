'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { AdminRole } from '@/types/database.types';

interface AdminUser extends AdminRole {
  user: {
    email: string;
  };
}

export default function AdminManagement() {
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    checkSuperAdminStatus();
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin]);

  const checkSuperAdminStatus = async () => {
    const { data: isSuperAdmin, error } = await supabase.rpc('is_super_admin');
    if (error) {
      console.error('Error checking super admin status:', error);
      return;
    }
    setIsSuperAdmin(isSuperAdmin);
    setLoading(false);
  };

  const fetchAdmins = async () => {
    try {
      const { data: adminRoles, error: adminError } = await supabase
        .from('admin_roles')
        .select(`
          *,
          user:user_id (
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (adminError) throw adminError;
      setAdmins(adminRoles as AdminUser[]);
    } catch (error) {
      console.error('Error fetching admins:', error);
      setError('Failed to fetch admin list');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // First, get the user ID from the email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', newAdminEmail)
        .single();

      if (userError || !userData) {
        setError('User not found with this email');
        return;
      }

      // Add the admin role
      const { error: addError } = await supabase.rpc('add_admin', {
        user_id_param: userData.user_id
      });

      if (addError) throw addError;

      setSuccess('Admin role added successfully');
      setNewAdminEmail('');
      fetchAdmins();
    } catch (error) {
      console.error('Error adding admin:', error);
      setError('Failed to add admin role');
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    try {
      const { error } = await supabase.rpc('remove_admin', {
        user_id_param: adminId
      });

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

  if (!isSuperAdmin) {
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
                  type="email"
                  required
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Enter email address"
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
                          {admin.user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {admin.role_type === 'super_admin' ? (
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
                          {new Date(admin.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {admin.role_type === 'admin' && (
                            <button
                              onClick={() => handleRemoveAdmin(admin.user_id)}
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
