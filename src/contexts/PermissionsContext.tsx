'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as permissions from '@/lib/permissions';

interface PermissionsContextType {
  userPermissions: string[];
  userRoles: string[];
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
  hasAllPermissions: (perms: string[]) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageCompetitions: boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canManageUsers, setCanManageUsers] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canManageCompetitions, setCanManageCompetitions] = useState(false);

  const loadPermissions = async () => {
    if (!user) {
      setUserPermissions([]);
      setUserRoles([]);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setCanManageUsers(false);
      setCanManageRoles(false);
      setCanManageCompetitions(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Load permissions and roles in parallel
      const [perms, roles, adminCheck, superAdminCheck, usersCheck, rolesCheck, compsCheck] = await Promise.all([
        permissions.getCurrentUserPermissions(),
        permissions.getCurrentUserRoles(),
        permissions.isAdmin(),
        permissions.isSuperAdmin(),
        permissions.canManageUsers(),
        permissions.canManageRoles(),
        permissions.canManageCompetitions(),
      ]);

      setUserPermissions(perms.map((p: any) => p.permission_name));
      setUserRoles(roles.map((r: any) => r.role_name));
      setIsAdmin(adminCheck);
      setIsSuperAdmin(superAdminCheck);
      setCanManageUsers(usersCheck);
      setCanManageRoles(rolesCheck);
      setCanManageCompetitions(compsCheck);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setUserPermissions([]);
      setUserRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [user]);

  // Local permission checks (fast, uses cached data)
  const hasPermission = (permission: string): boolean => {
    return userPermissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some(p => userPermissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    return perms.every(p => userPermissions.includes(p));
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(r => userRoles.includes(r));
  };

  const value: PermissionsContextType = {
    userPermissions,
    userRoles,
    loading,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    isAdmin,
    isSuperAdmin,
    canManageUsers,
    canManageRoles,
    canManageCompetitions,
    refresh: loadPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

/**
 * Component that only renders children if user has the required permission
 */
export function RequirePermission({
  permission,
  fallback = null,
  children,
}: {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, loading } = usePermissions();

  if (loading) return null;
  if (!hasPermission(permission)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user has ANY of the required permissions
 */
export function RequireAnyPermission({
  permissions,
  fallback = null,
  children,
}: {
  permissions: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasAnyPermission, loading } = usePermissions();

  if (loading) return null;
  if (!hasAnyPermission(permissions)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user has ALL of the required permissions
 */
export function RequireAllPermissions({
  permissions,
  fallback = null,
  children,
}: {
  permissions: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasAllPermissions, loading } = usePermissions();

  if (loading) return null;
  if (!hasAllPermissions(permissions)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user has the required role
 */
export function RequireRole({
  role,
  fallback = null,
  children,
}: {
  role: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasRole, loading } = usePermissions();

  if (loading) return null;
  if (!hasRole(role)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user has ANY of the required roles
 */
export function RequireAnyRole({
  roles,
  fallback = null,
  children,
}: {
  roles: string[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasAnyRole, loading } = usePermissions();

  if (loading) return null;
  if (!hasAnyRole(roles)) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user is an admin
 */
export function RequireAdmin({
  fallback = null,
  children,
}: {
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isAdmin, loading } = usePermissions();

  if (loading) return null;
  if (!isAdmin) return <>{fallback}</>;
  
  return <>{children}</>;
}

/**
 * Component that only renders children if user is a super admin
 */
export function RequireSuperAdmin({
  fallback = null,
  children,
}: {
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { isSuperAdmin, loading } = usePermissions();

  if (loading) return null;
  if (!isSuperAdmin) return <>{fallback}</>;
  
  return <>{children}</>;
}
