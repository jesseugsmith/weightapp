-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access to authenticated users" ON public.profiles;

-- Create more specific policies
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Add a unique constraint on user_id to prevent duplicates
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_user_id_key,
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);

-- Function to clean up any duplicate profiles
CREATE OR REPLACE FUNCTION clean_duplicate_profiles()
RETURNS void AS $$
DECLARE
    duplicate_user_id UUID;
BEGIN
    -- Find user_ids with multiple profiles
    FOR duplicate_user_id IN 
        SELECT user_id 
        FROM public.profiles 
        WHERE user_id IS NOT NULL 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the most recently updated profile and delete others
        DELETE FROM public.profiles 
        WHERE user_id = duplicate_user_id 
        AND id NOT IN (
            SELECT id 
            FROM public.profiles 
            WHERE user_id = duplicate_user_id 
            ORDER BY updated_at DESC 
            LIMIT 1
        );
    END LOOP;
    
    -- Delete any profiles with null user_id
    DELETE FROM public.profiles WHERE user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
