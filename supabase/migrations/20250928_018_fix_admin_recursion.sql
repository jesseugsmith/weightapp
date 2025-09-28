-- First disable RLS temporarily to ensure we can modify everything
ALTER TABLE public.admin_roles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can view all admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Super admins can manage admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Users can view their own admin role" ON public.admin_roles;
DROP POLICY IF EXISTS "Super admins view all" ON public.admin_roles;
DROP POLICY IF EXISTS "Super admins manage all" ON public.admin_roles;

-- Create a temporary helper table for super admin lookups
CREATE TABLE IF NOT EXISTS public.admin_lookup (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    last_verified TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Populate the lookup table from admin_roles
INSERT INTO public.admin_lookup (user_id, is_super_admin)
SELECT user_id, (role_type = 'super_admin') AS is_super_admin
FROM public.admin_roles
ON CONFLICT (user_id) DO UPDATE
SET is_super_admin = (EXCLUDED.is_super_admin OR admin_lookup.is_super_admin),
    last_verified = TIMEZONE('utc'::text, NOW());

-- Create trigger to keep lookup table in sync
CREATE OR REPLACE FUNCTION update_admin_lookup()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        INSERT INTO public.admin_lookup (user_id, is_super_admin)
        VALUES (NEW.user_id, NEW.role_type = 'super_admin')
        ON CONFLICT (user_id) DO UPDATE
        SET is_super_admin = (EXCLUDED.is_super_admin OR admin_lookup.is_super_admin),
            last_verified = TIMEZONE('utc'::text, NOW());
    ELSIF TG_OP = 'DELETE' THEN
        -- Only remove from lookup if no admin role remains
        IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = OLD.user_id) THEN
            DELETE FROM public.admin_lookup WHERE user_id = OLD.user_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_roles_lookup_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.admin_roles
FOR EACH ROW EXECUTE FUNCTION update_admin_lookup();

-- Create simplified policies using the lookup table
CREATE POLICY "Users can view their own admin role" ON public.admin_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins view all" ON public.admin_roles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_lookup
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

CREATE POLICY "Super admins manage all" ON public.admin_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.admin_lookup
            WHERE user_id = auth.uid() AND is_super_admin = true
        )
    );

-- Update helper functions to use the lookup table
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_lookup
        WHERE user_id = auth.uid() AND is_super_admin = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_roles
        WHERE user_id = auth.uid()
    );
END;
$$;

-- Re-enable RLS
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

-- Refresh the lookup table one final time
INSERT INTO public.admin_lookup (user_id, is_super_admin)
SELECT user_id, (role_type = 'super_admin') AS is_super_admin
FROM public.admin_roles
ON CONFLICT (user_id) DO UPDATE
SET is_super_admin = (EXCLUDED.is_super_admin OR admin_lookup.is_super_admin),
    last_verified = TIMEZONE('utc'::text, NOW());
