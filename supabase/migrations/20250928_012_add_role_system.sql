-- Create roles and permissions tables
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL, -- e.g., 'competitions', 'users', 'weights'
    action TEXT NOT NULL,   -- e.g., 'create', 'read', 'update', 'delete'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id, role_id)
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for roles table
CREATE POLICY "Roles are viewable by all authenticated users" ON public.roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only super admins can manage roles" ON public.roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid() 
            AND role_type = 'super_admin'
        )
    );

-- Create policies for permissions table
CREATE POLICY "Permissions are viewable by all authenticated users" ON public.permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only super admins can manage permissions" ON public.permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid() 
            AND role_type = 'super_admin'
        )
    );

-- Create policies for role_permissions table
CREATE POLICY "Role permissions are viewable by all authenticated users" ON public.role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only super admins can manage role permissions" ON public.role_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid() 
            AND role_type = 'super_admin'
        )
    );

-- Create policies for user_roles table
CREATE POLICY "User roles are viewable by admins and the user themselves" ON public.user_roles
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Only admins can manage user roles" ON public.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Create helper functions
CREATE OR REPLACE FUNCTION has_permission(permission_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
        AND p.name = permission_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION has_role(role_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid()
        AND r.name = role_name
    );
END;
$$;

-- Create function to assign role to user
CREATE OR REPLACE FUNCTION assign_role(user_id_param UUID, role_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    role_id_var UUID;
BEGIN
    -- Check if user is admin
    IF NOT (SELECT is_admin()) THEN
        RAISE EXCEPTION 'Only admins can assign roles';
    END IF;

    -- Get role ID
    SELECT id INTO role_id_var
    FROM public.roles
    WHERE name = role_name;

    IF role_id_var IS NULL THEN
        RAISE EXCEPTION 'Role does not exist';
    END IF;

    -- Assign role
    INSERT INTO public.user_roles (user_id, role_id, created_by)
    VALUES (user_id_param, role_id_var, auth.uid())
    ON CONFLICT (user_id, role_id) DO NOTHING;

    RETURN true;
END;
$$;

-- Create function to remove role from user
CREATE OR REPLACE FUNCTION remove_role(user_id_param UUID, role_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    role_id_var UUID;
BEGIN
    -- Check if user is admin
    IF NOT (SELECT is_admin()) THEN
        RAISE EXCEPTION 'Only admins can remove roles';
    END IF;

    -- Get role ID
    SELECT id INTO role_id_var
    FROM public.roles
    WHERE name = role_name;

    IF role_id_var IS NULL THEN
        RAISE EXCEPTION 'Role does not exist';
    END IF;

    -- Remove role
    DELETE FROM public.user_roles 
    WHERE user_id = user_id_param 
    AND role_id = role_id_var;

    RETURN true;
END;
$$;

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES
    ('super_admin', 'Full system access and can manage other admins'),
    ('admin', 'Can manage users and content'),
    ('moderator', 'Can moderate user content and competitions'),
    ('premium_user', 'Access to premium features'),
    ('user', 'Basic user access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO public.permissions (name, description, resource, action) VALUES
    ('manage_users', 'Can manage user accounts', 'users', 'manage'),
    ('view_users', 'Can view user profiles', 'users', 'read'),
    ('manage_competitions', 'Can manage competitions', 'competitions', 'manage'),
    ('join_competitions', 'Can join competitions', 'competitions', 'join'),
    ('create_competitions', 'Can create new competitions', 'competitions', 'create'),
    ('manage_invites', 'Can manage invite tokens', 'invites', 'manage'),
    ('view_analytics', 'Can view analytics data', 'analytics', 'read'),
    ('manage_roles', 'Can manage user roles', 'roles', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign default permissions to roles
DO $$
DECLARE
    role_id_var UUID;
    permission_id_var UUID;
BEGIN
    -- Super Admin gets all permissions
    SELECT id INTO role_id_var FROM public.roles WHERE name = 'super_admin';
    FOR permission_id_var IN SELECT id FROM public.permissions
    LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (role_id_var, permission_id_var)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;

    -- Admin permissions
    SELECT id INTO role_id_var FROM public.roles WHERE name = 'admin';
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT role_id_var, id FROM public.permissions
    WHERE name IN ('manage_users', 'view_users', 'manage_competitions', 'manage_invites', 'view_analytics')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Moderator permissions
    SELECT id INTO role_id_var FROM public.roles WHERE name = 'moderator';
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT role_id_var, id FROM public.permissions
    WHERE name IN ('view_users', 'manage_competitions', 'view_analytics')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Premium user permissions
    SELECT id INTO role_id_var FROM public.roles WHERE name = 'premium_user';
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT role_id_var, id FROM public.permissions
    WHERE name IN ('join_competitions', 'create_competitions')
    ON CONFLICT (role_id, permission_id) DO NOTHING;

    -- Basic user permissions
    SELECT id INTO role_id_var FROM public.roles WHERE name = 'user';
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT role_id_var, id FROM public.permissions
    WHERE name IN ('join_competitions')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
END $$;
