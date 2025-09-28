-- Create signup tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.signup_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    created_by UUID REFERENCES auth.users(id),
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES auth.users(id)
);

-- Create RLS policies for signup tokens
ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can view all tokens
CREATE POLICY "Admins can view all tokens" ON public.signup_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- Only admins can create new tokens
CREATE POLICY "Admins can create tokens" ON public.signup_tokens
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND raw_user_meta_data->>'is_admin' = 'true'
        )
    );

-- Anyone can use their own token
CREATE POLICY "Users can update their own token when used" ON public.signup_tokens
    FOR UPDATE USING (
        auth.email() = email
    ) WITH CHECK (
        auth.email() = email AND
        used_at IS NULL AND
        used_by IS NULL AND
        expires_at > NOW()
    );

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_signup_tokens_token ON public.signup_tokens(token);

-- Create index for expiration date
CREATE INDEX IF NOT EXISTS idx_signup_tokens_expires_at ON public.signup_tokens(expires_at);
