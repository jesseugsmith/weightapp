-- Ensure super_admin has the view_audit_logs permission
DO $$
DECLARE
    super_admin_role_id UUID;
    audit_permission_id UUID;
BEGIN
    -- Get the super_admin role ID
    SELECT id INTO super_admin_role_id
    FROM public.roles
    WHERE name = 'super_admin';

    -- Get the view_audit_logs permission ID
    SELECT id INTO audit_permission_id
    FROM public.permissions
    WHERE name = 'view_audit_logs';

    -- Assign permission if not already assigned
    INSERT INTO public.role_permissions (role_id, permission_id)
    VALUES (super_admin_role_id, audit_permission_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Output for verification
    RAISE NOTICE 'Super admin role ID: %, Audit permission ID: %', super_admin_role_id, audit_permission_id;
END $$;

-- Double-check your user has the super_admin role
DO $$
DECLARE
    target_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    -- Get your user ID (replace with your email)
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'jessieeugenejr@gmail.com';

    -- Get super_admin role ID
    SELECT id INTO super_admin_role_id
    FROM public.roles
    WHERE name = 'super_admin';

    -- Ensure you have the super_admin role
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (target_user_id, super_admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Output for verification
    RAISE NOTICE 'User ID: %, Super admin role ID: %', target_user_id, super_admin_role_id;
END $$;
