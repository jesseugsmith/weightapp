-- Create audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admin_roles 
            WHERE user_id = auth.uid()
        )
    );

-- Create function to log role changes
CREATE OR REPLACE FUNCTION log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    acting_user UUID;
BEGIN
    -- Get the user who is making the change
    acting_user := COALESCE(auth.uid(), NEW.created_by, OLD.created_by);
    
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (
            action,
            entity_type,
            entity_id,
            user_id,
            new_values
        ) VALUES (
            'assign_role',
            'user_roles',
            NEW.id,
            acting_user,
            jsonb_build_object(
                'user_id', NEW.user_id,
                'role_id', NEW.role_id
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (
            action,
            entity_type,
            entity_id,
            user_id,
            old_values
        ) VALUES (
            'remove_role',
            'user_roles',
            OLD.id,
            auth.uid(),
            jsonb_build_object(
                'user_id', OLD.user_id,
                'role_id', OLD.role_id
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for role changes
CREATE TRIGGER role_audit_trigger
    AFTER INSERT OR DELETE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_role_change();

-- Create function to view audit logs with user details
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
