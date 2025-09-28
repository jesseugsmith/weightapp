-- Drop and recreate the get_audit_logs function to return JSON
CREATE OR REPLACE FUNCTION get_audit_logs(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT row_to_json(logs)
    FROM (
        SELECT 
            al.id,
            al.action,
            al.entity_type,
            al.entity_id,
            COALESCE(u.email, 'Unknown User') as performed_by,
            al.old_values,
            al.new_values,
            al.created_at
        FROM public.audit_logs al
        LEFT JOIN auth.users u ON u.id = al.user_id
        WHERE 
            (start_date IS NULL OR al.created_at >= start_date) AND
            (end_date IS NULL OR al.created_at <= end_date)
        ORDER BY al.created_at DESC
    ) logs;
END;
$$;

-- Update the RLS policy for audit_logs to use the permission system
DROP POLICY IF EXISTS "Users with audit log permission can view logs" ON public.audit_logs;
CREATE POLICY "Users with audit log permission can view logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 
            FROM public.user_roles ur
            JOIN public.role_permissions rp ON rp.role_id = ur2.role_id
            JOIN public.permissions p ON p.id = rp.permission_id
            WHERE ur.user_id = auth.uid()
            AND p.name = 'view_audit_logs'
        )
    );
