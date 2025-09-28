-- Drop existing RLS policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create new policy that uses the permission system
CREATE POLICY "Users with view_audit_logs permission can view logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM public.user_roles ur
            JOIN public.role_permissions rp ON rp.role_id = ur.role_id
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
            AND p.name = 'view_audit_logs'
        )
    );

-- Modify the get_audit_logs function to check permissions
CREATE OR REPLACE FUNCTION get_audit_logs(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    action TEXT,
    entity_type TEXT,
    entity_id UUID,
    performed_by TEXT,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the user has permission to view audit logs
    IF NOT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
        AND p.name = 'view_audit_logs'
    ) THEN
        RAISE EXCEPTION 'Permission denied: view_audit_logs required';
    END IF;

    RETURN QUERY
    SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        p.email as performed_by,
        al.old_values,
        al.new_values,
        al.created_at
    FROM public.audit_logs al
    JOIN public.profiles p ON p.user_id = al.user_id
    WHERE 
        (start_date IS NULL OR al.created_at >= start_date) AND
        (end_date IS NULL OR al.created_at <= end_date)
    ORDER BY al.created_at DESC;
END;
$$;
