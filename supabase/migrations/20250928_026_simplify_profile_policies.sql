-- Drop and recreate profiles policies with simpler rules
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

    -- Create simplified policies
    CREATE POLICY "Enable all access to authenticated users"
        ON public.profiles
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);

END $$;

-- Double check that RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.profiles TO authenticated;

-- Verify current user has necessary permissions
DO $$ 
BEGIN
    RAISE NOTICE 'Current user: %', auth.uid();
    RAISE NOTICE 'Is authenticated: %', auth.role() = 'authenticated';
END $$;
