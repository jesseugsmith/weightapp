-- Add unique constraint to ensure one role per user
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_single_role;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_single_role UNIQUE (user_id);

-- Update assign_role function to replace existing role instead of adding new one
CREATE OR REPLACE FUNCTION assign_role(user_id_param UUID, role_name TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_id_var UUID;
BEGIN
    -- Check if user has permission to manage roles
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
        AND p.name = 'manage_users'
    ) THEN
        RAISE EXCEPTION 'Permission denied: manage_users required';
    END IF;

    -- Get role ID
    SELECT id INTO role_id_var
    FROM public.roles
    WHERE name = role_name;

    IF role_id_var IS NULL THEN
        RAISE EXCEPTION 'Role does not exist';
    END IF;

    -- Delete any existing role for the user
    DELETE FROM public.user_roles
    WHERE user_id = user_id_param;

    -- Insert new role
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (user_id_param, role_id_var);

    RETURN true;
END;
$$;
