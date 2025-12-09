import { supabase } from './supabase';

/**
 * Roles and Permissions utilities for Supabase
 * Use these functions to check user permissions and roles
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  expires_at: string | null;
  role?: Role;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  permission?: Permission;
}

// ============================================================================
// PERMISSION CHECKING
// ============================================================================

/**
 * Check if the current user has a specific permission
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('user_has_permission', {
      user_id_param: user.id,
      permission_name_param: permissionName,
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(roleName: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('user_has_role', {
      user_id_param: user.id,
      role_name_param: roleName,
    });

    if (error) {
      console.error('Error checking role:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function hasAnyPermission(permissions: string[]): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map(permission => hasPermission(permission))
  );
  return checks.some(result => result === true);
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function hasAllPermissions(permissions: string[]): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map(permission => hasPermission(permission))
  );
  return checks.every(result => result === true);
}

/**
 * Check if user has ANY of the specified roles
 */
export async function hasAnyRole(roles: string[]): Promise<boolean> {
  const checks = await Promise.all(
    roles.map(role => hasRole(role))
  );
  return checks.some(result => result === true);
}

// ============================================================================
// GET USER PERMISSIONS & ROLES
// ============================================================================

/**
 * Get all permissions for the current user
 */
export async function getCurrentUserPermissions() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_id_param: user.id,
    });

    if (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Get all roles for the current user
 */
export async function getCurrentUserRoles() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.rpc('get_user_roles', {
      user_id_param: user.id,
    });

    if (error) {
      console.error('Error getting user roles:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Get permissions for a specific user (admin only)
 */
export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_user_permissions', {
      user_id_param: userId,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user permissions:', error);
    throw error;
  }
}

/**
 * Get roles for a specific user (admin only)
 */
export async function getUserRoles(userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_user_roles', {
      user_id_param: userId,
    });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting user roles:', error);
    throw error;
  }
}

// ============================================================================
// ROLE MANAGEMENT (Admin only)
// ============================================================================

/**
 * Get all available roles
 */
export async function getAllRoles(): Promise<Role[]> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }
}

/**
 * Get all available permissions
 */
export async function getAllPermissions(): Promise<Permission[]> {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('resource, action');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw error;
  }
}

/**
 * Get permissions for a specific role
 */
export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .select('permission:permissions(*)')
      .eq('role_id', roleId);

    if (error) throw error;
    return data?.map((rp: any) => rp.permission) || [];
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw error;
  }
}

/**
 * Assign a role to a user (admin only)
 */
export async function assignRoleToUser(
  userId: string,
  roleName: string,
  expiresAt?: string
): Promise<void> {
  try {
    // Get role ID by name
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError) throw roleError;
    if (!role) throw new Error(`Role '${roleName}' not found`);

    // Get current user for assigned_by
    const { data: { user } } = await supabase.auth.getUser();

    // Assign role
    const { error: assignError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: role.id,
        assigned_by: user?.id || null,
        expires_at: expiresAt || null,
      });

    if (assignError) throw assignError;
  } catch (error) {
    console.error('Error assigning role to user:', error);
    throw error;
  }
}

/**
 * Remove a role from a user (admin only)
 */
export async function removeRoleFromUser(
  userId: string,
  roleName: string
): Promise<void> {
  try {
    // Get role ID by name
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError) throw roleError;
    if (!role) throw new Error(`Role '${roleName}' not found`);

    // Remove role assignment
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', role.id);

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error removing role from user:', error);
    throw error;
  }
}

/**
 * Get all users with a specific role (admin only)
 */
export async function getUsersByRole(roleName: string) {
  try {
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (roleError) throw roleError;

    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, assigned_at, expires_at')
      .eq('role_id', role.id);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
}

/**
 * Create a new role (super admin only)
 */
export async function createRole(
  name: string,
  description?: string
): Promise<Role> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .insert({
        name,
        description,
        is_system: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
}

/**
 * Update a role (admin only)
 */
export async function updateRole(
  roleId: string,
  updates: { name?: string; description?: string }
): Promise<Role> {
  try {
    const { data, error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
}

/**
 * Delete a role (admin only, cannot delete system roles)
 */
export async function deleteRole(roleId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('is_system', false);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
}

/**
 * Add a permission to a role (admin only)
 */
export async function addPermissionToRole(
  roleId: string,
  permissionId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('role_permissions')
      .insert({
        role_id: roleId,
        permission_id: permissionId,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding permission to role:', error);
    throw error;
  }
}

/**
 * Remove a permission from a role (admin only)
 */
export async function removePermissionFromRole(
  roleId: string,
  permissionId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId);

    if (error) throw error;
  } catch (error) {
    console.error('Error removing permission from role:', error);
    throw error;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Check if current user is admin (has admin or super_admin role)
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Prefer explicit membership in admin_users
    const { data: adminRow, error } = await supabase
      .from('admin_users')
      .select('user_id, active')
      .eq('user_id', user.id)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error('Error checking admin_users membership:', error);
    }

    if (adminRow?.user_id) {
      return true;
    }

    // Fallback to role-based admin
    return await hasAnyRole(['admin', 'super_admin']);
  } catch (err) {
    console.error('Error determining admin status:', err);
    return false;
  }
}

/**
 * Check if current user is super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  return await hasRole('super_admin');
}

/**
 * Check if current user can manage users
 */
export async function canManageUsers(): Promise<boolean> {
  return await hasAnyPermission(['users.manage', 'users.update', 'users.delete']);
}

/**
 * Check if current user can manage roles
 */
export async function canManageRoles(): Promise<boolean> {
  return await hasAnyPermission(['roles.manage', 'roles.assign']);
}

/**
 * Check if current user can manage competitions
 */
export async function canManageCompetitions(): Promise<boolean> {
  return await hasAnyPermission(['competitions.manage', 'competitions.update', 'competitions.delete']);
}

export default {
  // Permission checking
  hasPermission,
  hasRole,
  hasAnyPermission,
  hasAllPermissions,
  hasAnyRole,
  
  // Get user permissions/roles
  getCurrentUserPermissions,
  getCurrentUserRoles,
  getUserPermissions,
  getUserRoles,
  
  // Role management
  getAllRoles,
  getAllPermissions,
  getRolePermissions,
  assignRoleToUser,
  removeRoleFromUser,
  getUsersByRole,
  createRole,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  
  // Convenience
  isAdmin,
  isSuperAdmin,
  canManageUsers,
  canManageRoles,
  canManageCompetitions,
};
