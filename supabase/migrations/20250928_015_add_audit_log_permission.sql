-- Add view_audit_logs permission
INSERT INTO public.permissions (name, description, resource, action)
VALUES ('view_audit_logs', 'Can view system audit logs', 'audit_logs', 'read')
ON CONFLICT (name) DO NOTHING;

-- Assign permission to super_admin and admin roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('super_admin', 'admin')
  AND p.name = 'view_audit_logs'
ON CONFLICT (role_id, permission_id) DO NOTHING;
