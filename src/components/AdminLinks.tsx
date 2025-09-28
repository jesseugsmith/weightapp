import { usePermissions } from '@/contexts/PermissionContext';
import Link from 'next/link';

interface AdminLink {
  href: string;
  label: string;
  requiredPermission: string;
  description: string;
}

const adminLinks: AdminLink[] = [
  {
    href: '/admin/users',
    label: 'User & Role Management',
    requiredPermission: 'manage_users',
    description: 'Manage users, roles, and permissions'
  },
  {
    href: '/admin/invites',
    label: 'Invite Management',
    requiredPermission: 'manage_invites',
    description: 'Create and manage user invites'
  },
  {
    href: '/admin/audit-logs',
    label: 'Audit Logs',
    requiredPermission: 'view_audit_logs',
    description: 'View system audit logs'
  }
];

export default function AdminLinks({ className = '' }: { className?: string }) {
  const { hasPermission, loading } = usePermissions();

  if (loading) return null;

  // Filter links based on user permissions
  const availableLinks = adminLinks.filter(link => hasPermission(link.requiredPermission));

  if (availableLinks.length === 0) return null;

  return (
    <div className={className}>
      <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
        Admin
      </div>
      {availableLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          role="menuitem"
        >
          <div className="font-medium">{link.label}</div>
          <div className="text-xs text-gray-500">{link.description}</div>
        </Link>
      ))}
    </div>
  );
}
