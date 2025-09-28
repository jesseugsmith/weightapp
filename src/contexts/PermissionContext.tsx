'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/utils/supabase';
import type { Role, Permission } from '@/types/database.types';

interface PermissionContextType {
  loading: boolean;
  roles: Role[];
  permissions: Permission[];
  hasPermission: (permissionName: string) => boolean;
  hasRole: (roleName: string) => boolean;
  can: (resource: string, action: string) => boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserRolesAndPermissions();
    } else {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRolesAndPermissions = async () => {
    try {
      // First fetch user's roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select(`
          role:roles (
            id,
            name,
            description
          )
        `)
        .eq('user_id', user?.id);

      if (rolesError) throw rolesError;

      if (userRoles) {
        const roles = userRoles
          .map(ur => ur.role)
          .filter((r): r is Role => !!r);
        setRoles(roles);

        // Then fetch permissions for these roles
        const roleIds = roles.map(r => r.id);
        if (roleIds.length > 0) {
          const { data: rolePermissions, error: permError } = await supabase
            .from('role_permissions')
            .select(`
              permissions (
                id,
                name,
                description,
                resource,
                action
              )
            `)
            .in('role_id', roleIds);

          if (permError) throw permError;

          if (rolePermissions) {
            const permissions = rolePermissions
              .map(rp => rp.permissions)
              .filter((p): p is Permission => !!p);

            // Remove duplicates
            const uniquePermissions = Array.from(
              new Map(permissions.map(p => [p.id, p])).values()
            );
            setPermissions(uniquePermissions);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionName: string) => {
    return permissions.some(p => p.name === permissionName);
  };

  const hasRole = (roleName: string) => {
    return roles.some(r => r.name === roleName);
  };

  const can = (resource: string, action: string) => {
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  return (
    <PermissionContext.Provider
      value={{
        loading,
        roles,
        permissions,
        hasPermission,
        hasRole,
        can,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}
