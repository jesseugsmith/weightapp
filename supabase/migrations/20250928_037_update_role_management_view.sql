-- Update role management view to include photo_url
DROP VIEW IF EXISTS public.role_management;

CREATE OR REPLACE VIEW public.role_management AS
SELECT 
    p.id as profile_id,
    p.user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.photo_url,
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
    -- User must have manage_users permission
    SELECT 1 
    FROM public.user_roles ur2
    JOIN public.role_permissions rp2 ON rp2.role_id = ur2.role_id
    JOIN public.permissions p2 ON p2.id = rp2.permission_id
    WHERE ur2.user_id = auth.uid()
    AND p2.name = 'manage_users'
)
GROUP BY p.id, p.user_id, p.first_name, p.last_name, p.nickname, p.photo_url, u.email;
