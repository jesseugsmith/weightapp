CREATE OR REPLACE FUNCTION check_signup_token(token_param text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM signup_tokens 
    WHERE token = token_param
    AND expires_at > NOW()
  );
END;
$$;

-- Function to record token usage
CREATE OR REPLACE FUNCTION record_token_usage(token_param text, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  token_id uuid;
BEGIN
  -- Get the token ID
  SELECT id INTO token_id
  FROM signup_tokens
  WHERE token = token_param
  AND expires_at > NOW();

  IF token_id IS NULL THEN
    RETURN false;
  END IF;

  -- Record the usage
  INSERT INTO signup_token_usage (token_id, user_id)
  VALUES (token_id, user_id_param);

  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    -- User has already used this token
    RETURN false;
END;
$$;
