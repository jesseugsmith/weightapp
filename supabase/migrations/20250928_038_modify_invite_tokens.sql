-- Drop the email requirement from signup_tokens
ALTER TABLE signup_tokens 
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (NOW() + interval '48 hours');

-- Add a new index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_signup_tokens_token ON signup_tokens(token);

-- Update the RLS policies to not require email
DROP POLICY IF EXISTS "Admins can create tokens" ON signup_tokens;
CREATE POLICY "Admins can create tokens" ON signup_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_admin())
  );

-- Update any related functions
CREATE OR REPLACE FUNCTION create_invite_token()
RETURNS signup_tokens
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_token signup_tokens;
BEGIN
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Only admins can create invite tokens';
  END IF;

  INSERT INTO signup_tokens (
    token,
    expires_at
  ) VALUES (
    encode(gen_random_bytes(32), 'hex'),
    NOW() + interval '48 hours'
  )
  RETURNING * INTO new_token;

  RETURN new_token;
END;
$$;
