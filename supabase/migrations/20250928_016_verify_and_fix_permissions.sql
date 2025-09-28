-- First, let's make sure the tables exist and create them if they don't
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role_id)
);

-- Insert default roles if they don't exist
INSERT INTO public.roles (name, description)
VALUES 
    ('super_admin', 'Full system access and can manage other admins'),
    ('admin', 'Can manage users and content'),
    ('moderator', 'Can moderate user content and competitions'),
    ('premium_user', 'Access to premium features'),
    ('user', 'Basic user access')
ON CONFLICT (name) DO NOTHING;

-- Insert base permissions if they don't exist
INSERT INTO public.permissions (name, description, resource, action)
VALUES
    ('manage_roles', 'Can manage user roles', 'roles', 'manage'),
    ('view_users', 'Can view user profiles', 'users', 'read'),
    ('manage_users', 'Can manage user accounts', 'users', 'manage'),
    ('manage_competitions', 'Can manage competitions', 'competitions', 'manage'),
    ('join_competitions', 'Can join competitions', 'competitions', 'join'),
    ('create_competitions', 'Can create new competitions', 'competitions', 'create'),
    ('manage_invites', 'Can manage invite tokens', 'invites', 'manage'),
    ('view_analytics', 'Can view analytics data', 'analytics', 'read'),
    ('view_audit_logs', 'Can view system audit logs', 'audit_logs', 'read')
ON CONFLICT (name) DO NOTHING;

-- Get your user ID
DO $$
DECLARE
    target_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'jessieeugenejr@gmail.com';

    -- Get super_admin role ID
    SELECT id INTO super_admin_role_id
    FROM roles
    WHERE name = 'super_admin';

    -- Assign all permissions to super_admin role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT super_admin_role_id, id
    FROM permissions
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Make sure user has super_admin role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (target_user_id, super_admin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Output verification message
    RAISE NOTICE 'User ID: %, Role ID: %', target_user_id, super_admin_role_id;
END $$;

-- Verify the setup with these queries:
-- SELECT * FROM roles WHERE name = 'super_admin';
-- SELECT p.name, p.resource, p.action
-- FROM permissions p
-- JOIN role_permissions rp ON rp.permission_id = p.id
-- WHERE rp.role_id = (SELECT id FROM roles WHERE name = 'super_admin');
-- SELECT * FROM user_roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'jessieeugenejr@gmail.com');
