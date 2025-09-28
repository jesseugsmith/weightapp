-- Drop existing policies and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Auth can insert profiles" ON profiles;

-- Recreate the function with proper security context and error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add some logging
  RAISE LOG 'Creating profile for user: %', NEW.id;
  
  BEGIN
    INSERT INTO public.profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE LOG 'Error creating profile: %', SQLERRM;
    RETURN NEW;
  END;
  
  RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT ALL ON public.profiles TO postgres, authenticated, anon;

-- Add policies for profile creation
CREATE POLICY "System can insert profiles"
  ON profiles
  FOR INSERT
  TO postgres, authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Auth can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
