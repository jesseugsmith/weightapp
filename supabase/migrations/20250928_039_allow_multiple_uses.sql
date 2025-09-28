-- Modify the signup_tokens table to support multiple uses
ALTER TABLE signup_tokens 
  DROP COLUMN IF EXISTS used_at,
  DROP COLUMN IF EXISTS used_by;

-- Create a new table to track token usage
CREATE TABLE IF NOT EXISTS signup_token_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id uuid REFERENCES signup_tokens(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz DEFAULT NOW(),
  UNIQUE(token_id, user_id)
);

-- Add RLS policies for token usage
ALTER TABLE signup_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own token usage"
  ON signup_token_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Insert on signup"
  ON signup_token_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update the token validation function to check expiration only
CREATE OR REPLACE FUNCTION validate_signup_token(token_text text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM signup_tokens 
    WHERE token = token_text
    AND expires_at > NOW()
  );
END;
$$;
