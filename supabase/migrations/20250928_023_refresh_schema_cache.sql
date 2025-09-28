-- Refresh schema cache for profiles table
COMMENT ON TABLE public.profiles IS 'User profiles with basic information';

-- Refresh column comments
COMMENT ON COLUMN public.profiles.date_of_birth IS 'User''s date of birth';
COMMENT ON COLUMN public.profiles.first_name IS 'User''s first name';
COMMENT ON COLUMN public.profiles.last_name IS 'User''s last name';
COMMENT ON COLUMN public.profiles.nickname IS 'User''s nickname';
