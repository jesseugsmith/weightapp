-- Create admin roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL CHECK (role_type IN ('super_admin', 'admin')), -- super_admin can manage other admins
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Only super admins can view all admin roles
CREATE POLICY "Super admins can view all admin roles" ON public.admin_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles ar 
            WHERE ar.user_id = auth.uid() 
            AND ar.role_type = 'super_admin'
        )
    );

-- Only super admins can manage admin roles
CREATE POLICY "Super admins can manage admin roles" ON public.admin_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles ar 
            WHERE ar.user_id = auth.uid() 
            AND ar.role_type = 'super_admin'
        )
    );

-- Create function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = auth.uid() 
        AND role_type IN ('admin', 'super_admin')
    );
END;
$$;

-- Create function to check if a user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_roles 
        WHERE user_id = auth.uid() 
        AND role_type = 'super_admin'
    );
END;
$$;

-- Create functions to manage admin roles (only callable by super admins)
CREATE OR REPLACE FUNCTION add_admin(user_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the current user is a super admin
    IF NOT (SELECT is_super_admin()) THEN
        RAISE EXCEPTION 'Only super admins can add new admins';
    END IF;

    -- Add the new admin
    INSERT INTO public.admin_roles (user_id, role_type, created_by)
    VALUES (user_id_param, 'admin', auth.uid())
    ON CONFLICT (user_id) DO NOTHING;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION remove_admin(user_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the current user is a super admin
    IF NOT (SELECT is_super_admin()) THEN
        RAISE EXCEPTION 'Only super admins can remove admins';
    END IF;

    -- Cannot remove super admins
    IF EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = user_id_param AND role_type = 'super_admin') THEN
        RAISE EXCEPTION 'Cannot remove super admin role';
    END IF;

    -- Remove the admin
    DELETE FROM public.admin_roles WHERE user_id = user_id_param AND role_type = 'admin';
    RETURN true;
END;
$$;

-- Insert the first super admin (replace 'SUPER_ADMIN_USER_ID' with the actual UUID)
-- This should be done manually through the database for security
-- INSERT INTO public.admin_roles (user_id, role_type) VALUES ('SUPER_ADMIN_USER_ID', 'super_admin');
