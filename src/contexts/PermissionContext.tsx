'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { pb } from '@/lib/pocketbase';

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface Permission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}

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
      const userRoles = await pb.collection('user_roles').getFullList({
        filter: `user_id = "${user?.id}"`,
        expand: 'role_id'
      });

      if (userRoles) {
        const roles = userRoles
          .map(ur => ur.expand?.role_id)
          .filter((r): r is Role => !!r);
        setRoles(roles);

        // Then fetch permissions for these roles
        const roleIds = roles.map(r => r.id);
        if (roleIds.length > 0) {
          const rolePermissions = await pb.collection('role_permissions').getFullList({
            filter: roleIds.map(id => `role_id = "${id}"`).join(' || '),
            expand: 'permission_id'
          });

          if (rolePermissions) {
            const permissions = rolePermissions
              .map(rp => rp.expand?.permission_id)
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
