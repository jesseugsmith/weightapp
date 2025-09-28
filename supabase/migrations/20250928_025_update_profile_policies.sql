-- Update RLS policies for profiles table
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

    -- Create new policies
    CREATE POLICY "Users can view own profile"
        ON public.profiles
        FOR SELECT
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can update own profile"
        ON public.profiles
        FOR UPDATE
        USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own profile"
        ON public.profiles
        FOR INSERT
        WITH CHECK (
            auth.uid() = user_id AND 
            created_at = TIMEZONE('utc'::text, NOW()) AND 
            updated_at = TIMEZONE('utc'::text, NOW())
        );

    -- Create policy for deleting own profile
    CREATE POLICY "Users can delete own profile"
        ON public.profiles
        FOR DELETE
        USING (auth.uid() = user_id);
END $$;
