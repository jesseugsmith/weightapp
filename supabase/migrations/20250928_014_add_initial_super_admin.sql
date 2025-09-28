-- Function to safely create the initial super admin
CREATE OR REPLACE FUNCTION create_initial_super_admin(admin_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    -- Get the user ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = admin_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email %', admin_email;
    END IF;

    -- Get the super_admin role ID
    SELECT id INTO super_admin_role_id
    FROM roles
    WHERE name = 'super_admin';

    IF super_admin_role_id IS NULL THEN
        RAISE EXCEPTION 'super_admin role not found';
    END IF;

    -- Insert the admin role record
    INSERT INTO admin_roles (user_id, role_type, created_by)
    VALUES (target_user_id, 'super_admin', target_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert the user role record
    INSERT INTO user_roles (user_id, role_id, created_by)
    VALUES (target_user_id, super_admin_role_id, target_user_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
END;
$$;

-- Execute the function to create the initial super admin
SELECT create_initial_super_admin('jessieeugenejr@gmail.com');
