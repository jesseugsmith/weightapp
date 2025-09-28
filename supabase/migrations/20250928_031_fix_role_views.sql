-- Drop existing views if they exist
DROP VIEW IF EXISTS public.role_management;
DROP VIEW IF EXISTS public.user_profile_roles;

-- Create view with security check built in
CREATE OR REPLACE VIEW public.user_profile_roles AS
SELECT 
    p.id as profile_id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    ur.role_id,
    r.name as role_name,
    r.description as role_description
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
WHERE 
    -- User can see their own profile
    p.user_id = auth.uid()
    -- OR user has permission to view all users
    OR EXISTS (
        SELECT 1 
        FROM public.user_roles ur2
        JOIN public.role_permissions rp ON rp.role_id = ur2.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur2.user_id = auth.uid()
        AND p.name = 'view_all_users'
    );

-- Grant permissions for the view
GRANT SELECT ON public.user_profile_roles TO authenticated;

-- Create role management view with security check built in
CREATE OR REPLACE VIEW public.role_management AS
SELECT 
    p.id as profile_id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    u.email,
    array_remove(array_agg(DISTINCT r.name), NULL) as roles,
    array_remove(array_agg(DISTINCT perm.name), NULL) as permissions
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
LEFT JOIN public.permissions perm ON rp.permission_id = perm.id
WHERE EXISTS (
    -- User must have manage_roles permission
    SELECT 1 
    FROM public.user_roles ur2
    JOIN public.role_permissions rp2 ON rp2.role_id = ur2.role_id
    JOIN public.permissions p2 ON p2.id = rp2.permission_id
    WHERE ur2.user_id = auth.uid()
    AND p2.name = 'manage_roles'
)
GROUP BY p.id, p.user_id, p.first_name, p.last_name, p.nickname, u.email;

-- Grant permissions for role management view
GRANT SELECT ON public.role_management TO authenticated;

-- Create helper function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_id_param UUID)
RETURNS TABLE (
    role_name TEXT,
    role_description TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if user has permission to view roles
    IF auth.uid() = user_id_param OR EXISTS (
        SELECT 1 
        FROM public.user_roles ur2
        JOIN public.role_permissions rp ON rp.role_id = ur2.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur2.user_id = auth.uid()
        AND p.name = 'view_all_users'
    ) THEN
        RETURN QUERY
        SELECT 
            r.name,
            r.description
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = user_id_param;
    END IF;
END;
$$;
