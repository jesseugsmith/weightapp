-- Recreate profiles table if it doesn't exist or is missing columns
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            nickname VARCHAR(255),
            date_of_birth DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
        );

        -- Enable RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

        -- Create policies
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
            WITH CHECK (auth.uid() = user_id);

    ELSE 
        -- Add missing columns if table exists
        DO $columns$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
                ALTER TABLE public.profiles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'first_name') THEN
                ALTER TABLE public.profiles ADD COLUMN first_name VARCHAR(255);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_name') THEN
                ALTER TABLE public.profiles ADD COLUMN last_name VARCHAR(255);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'nickname') THEN
                ALTER TABLE public.profiles ADD COLUMN nickname VARCHAR(255);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'date_of_birth') THEN
                ALTER TABLE public.profiles ADD COLUMN date_of_birth DATE;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at') THEN
                ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
            END IF;

            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at') THEN
                ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
            END IF;
        END $columns$;
    END IF;

    -- Add indexes for better performance
    CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON public.profiles(user_id);
END $$;

-- Refresh schema cache
COMMENT ON TABLE public.profiles IS 'User profiles with basic information';
COMMENT ON COLUMN public.profiles.user_id IS 'References auth.users(id)';
COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';
COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';
COMMENT ON COLUMN public.profiles.nickname IS 'User''s nickname';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User''s date of birth';
COMMENT ON COLUMN public.profiles.created_at IS 'Timestamp when the profile was created';
COMMENT ON COLUMN public.profiles.updated_at IS 'Timestamp when the profile was last updated';
