import { createBrowserClient } from '@/lib/supabase';

/**
 * Check if the current user has a specific permission
 * This replaces the Supabase RPC call has_permission
 */
export async function hasPermission(permission: string, resource?: string): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user has admin role or super admin role
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('*, role_id(*)')
      .eq('user_id', user.id);

    if (userRolesError) throw userRolesError;

    for (const userRole of userRoles || []) {
      const role = userRole.role_id;
      if (!role) continue;

      // Check if this role has the required permission
      const { data: rolePermissions, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('*, permission_id(*)')
        .eq('role_id', role.id);

      if (rolePermsError) throw rolePermsError;

      for (const rolePerm of rolePermissions || []) {
        const perm = rolePerm.permission_id;
        if (perm && perm.name === permission) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Check if the current user is an admin
 * This replaces the Supabase RPC call is_admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user has admin or super_admin role
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('*, role_id(*)')
      .eq('user_id', user.id);

    if (error) throw error;

    for (const userRole of userRoles || []) {
      const role = userRole.role_id;
      if (role && (role.name === 'admin' || role.name === 'super_admin')) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if the current user is a super admin
 * This replaces the Supabase RPC call is_super_admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Check if user has super_admin role
    const { data: userRoles, error } = await supabase
      .from('user_roles')
      .select('*, role_id(*)')
      .eq('user_id', user.id);

    if (error) throw error;

    for (const userRole of userRoles || []) {
      const role = userRole.role_id;
      if (role && role.name === 'super_admin') {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

/**
 * Assign a role to a user
 * This replaces the Supabase RPC call assign_role
 */
export async function assignRole(userId: string, roleName: string): Promise<boolean> {
  try {
    const supabase = createBrowserClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return false;

    // Get the role by name
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('name', roleName)
      .single();

    if (roleError || !role) {
      throw new Error(`Role "${roleName}" not found`);
    }

    // Check if user already has this role
    const { data: existingUserRole, error: checkError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role_id', role.id);

    if (checkError) throw checkError;

    if (existingUserRole && existingUserRole.length > 0) {
      throw new Error('User already has this role');
    }

    // Assign the role
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert([{
        user_id: userId,
        role_id: role.id,
        assigned_by: currentUser.id,
        assigned_at: new Date().toISOString()
      }]);

    if (insertError) throw insertError;

    return true;
  } catch (error) {
    console.error('Error assigning role:', error);
    return false;
  }
}

/**
 * Remove a role from a user
 * This replaces the Supabase RPC call remove_role
 */
export async function removeRole(userId: string, roleName: string): Promise<boolean> {
  try {
    const supabase = createBrowserClient();

    // Get the role by name
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('name', roleName)
      .single();

    if (roleError || !role) {
      throw new Error(`Role "${roleName}" not found`);
    }

    // Delete the user role
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', role.id);

    if (deleteError) throw deleteError;

    return true;
  } catch (error) {
    console.error('Error removing role:', error);
    return false;
  }
}

/**
 * Add admin role to a user
 * This replaces the Supabase RPC call add_admin
 */
export async function addAdmin(userId: string, role: 'admin' | 'super_admin' = 'admin'): Promise<boolean> {
  return assignRole(userId, role);
}

/**
 * Remove admin role from a user
 * This replaces the Supabase RPC call remove_admin
 */
export async function removeAdmin(userId: string): Promise<boolean> {
  try {
    await removeRole(userId, 'admin');
    await removeRole(userId, 'super_admin');
    return true;
  } catch (error) {
    console.error('Error removing admin:', error);
    return false;
  }
}
