-- Check permission assignments for the user
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get your user ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'jessieeugenejr@gmail.com';

    -- Output all permissions for this user
    RAISE NOTICE 'Checking permissions for user %', target_user_id;
    
    -- Check user roles
    RAISE NOTICE 'User roles:';
    FOR r IN (
        SELECT r.name, r.description
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = target_user_id
    ) LOOP
        RAISE NOTICE 'Role: % (%)', r.name, r.description;
    END LOOP;

    -- Check permissions
    RAISE NOTICE 'User permissions:';
    FOR p IN (
        SELECT DISTINCT p.name, p.resource, p.action
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = target_user_id
    ) LOOP
        RAISE NOTICE 'Permission: % (% on %)', p.name, p.action, p.resource;
    END LOOP;

    -- Check specific audit log permission
    RAISE NOTICE 'Audit log permission check:';
    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = target_user_id
        AND p.name = 'view_audit_logs'
    ) THEN
        RAISE NOTICE 'User HAS view_audit_logs permission';
    ELSE
        RAISE NOTICE 'User DOES NOT HAVE view_audit_logs permission';
    END IF;

    -- Check if user is in admin_roles table
    IF EXISTS (
        SELECT 1 FROM public.admin_roles
        WHERE user_id = target_user_id
    ) THEN
        RAISE NOTICE 'User IS in admin_roles table';
    ELSE
        RAISE NOTICE 'User IS NOT in admin_roles table';
    END IF;
END $$;
