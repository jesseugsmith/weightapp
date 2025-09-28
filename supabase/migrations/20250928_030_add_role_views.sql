-- Add view to combine user, profile, and role information
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
LEFT JOIN public.roles r ON ur.role_id = r.id;

-- Add permissions for the view
GRANT SELECT ON public.user_profile_roles TO authenticated;

-- Create policy for the view
CREATE POLICY "Users can view own profile roles"
    ON public.user_profile_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Create policy for admins to view all profiles with roles
CREATE POLICY "Admins can view all profile roles"
    ON public.user_profile_roles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM public.user_roles ur2
            JOIN public.role_permissions rp ON rp.role_id = ur2.role_id
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE ur2.user_id = auth.uid()
            AND p.name = 'view_all_users'
        )
    );

-- Add view for role management
CREATE OR REPLACE VIEW public.role_management AS
SELECT 
    p.id as profile_id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    u.email,
    array_agg(DISTINCT r.name) as roles,
    array_agg(DISTINCT perm.name) as permissions
FROM public.profiles p
JOIN auth.users u ON p.user_id = u.id
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
LEFT JOIN public.role_permissions rp ON r.id = rp.role_id
LEFT JOIN public.permissions perm ON rp.permission_id = perm.id
GROUP BY p.id, p.user_id, p.first_name, p.last_name, p.nickname, u.email;

-- Grant permissions for role management view
GRANT SELECT ON public.role_management TO authenticated;

-- Create policy for role management view
CREATE POLICY "Admins can view role management"
    ON public.role_management
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM public.user_roles ur2
            JOIN public.role_permissions rp ON rp.role_id = ur2.role_id
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE ur2.user_id = auth.uid()
            AND p.name = 'manage_roles'
        )
    );
