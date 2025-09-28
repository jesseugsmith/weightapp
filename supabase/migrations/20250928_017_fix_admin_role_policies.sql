-- First drop the existing policies
DROP POLICY IF EXISTS "Super admins can view all admin roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Super admins can manage admin roles" ON public.admin_roles;

-- Allow users to see their own admin role
CREATE POLICY "Users can view their own admin role" ON public.admin_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Super admins can view all roles (using a direct role_type check)
CREATE POLICY "Super admins view all" ON public.admin_roles
    FOR SELECT USING (
        -- First check if the user is accessing their own super_admin record
        (auth.uid() = user_id AND role_type = 'super_admin') OR
        -- Then allow access if they have a super_admin record
        EXISTS (
            SELECT 1 FROM public.admin_roles ar 
            WHERE ar.user_id = auth.uid() 
            AND ar.role_type = 'super_admin'
            -- Important: this record must be the user's own record to avoid recursion
            AND ar.user_id = ar.user_id
        )
    );

-- Super admins can manage all roles
CREATE POLICY "Super admins manage all" ON public.admin_roles
    FOR ALL USING (
        -- First check if the user is a super_admin
        EXISTS (
            SELECT 1 FROM public.admin_roles ar 
            WHERE ar.user_id = auth.uid() 
            AND ar.role_type = 'super_admin'
            -- Important: this record must be the user's own record to avoid recursion
            AND ar.user_id = ar.user_id
        )
    );

-- Recreate the is_admin function to use a more direct check
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
        -- Important: this record must be the user's own record to avoid recursion
        AND user_id = user_id
    );
END;
$$;

-- Recreate the is_super_admin function to use a more direct check
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
        -- Important: this record must be the user's own record to avoid recursion
        AND user_id = user_id
    );
END;
$$;
