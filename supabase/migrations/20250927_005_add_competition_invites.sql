-- Revert any existing changes first
DROP TABLE IF EXISTS competition_invites;
DROP TABLE IF EXISTS competition_invite_codes;

-- Create a table for competition invite codes
CREATE TABLE competition_invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  max_uses INT,
  uses INT DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT valid_max_uses CHECK (max_uses IS NULL OR max_uses > 0)
);

-- Add RLS policies for invite codes
ALTER TABLE competition_invite_codes ENABLE ROW LEVEL SECURITY;

-- Allow participants to create invite codes for competitions they're in
CREATE POLICY "Participants can create invite codes" ON competition_invite_codes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM competition_participants
      WHERE competition_participants.competition_id = competition_invite_codes.competition_id
      AND competition_participants.user_id = auth.uid()
    )
  );

-- Allow anyone to read invite codes (they'll need the code to use it anyway)
CREATE POLICY "Anyone can read invite codes" ON competition_invite_codes
  FOR SELECT USING (true);

-- Allow creators to delete their own invite codes
CREATE POLICY "Creators can delete their invite codes" ON competition_invite_codes
  FOR DELETE USING (created_by = auth.uid());

-- Create a table for tracking individual invites
CREATE TABLE competition_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  code_id UUID REFERENCES competition_invite_codes(id) ON DELETE SET NULL,
  email TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(competition_id, email)
);

-- Add RLS policies for invites
ALTER TABLE competition_invites ENABLE ROW LEVEL SECURITY;

-- Allow participants to create invites for competitions they're in
CREATE POLICY "Participants can create invites" ON competition_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM competition_participants
      WHERE competition_participants.competition_id = competition_invites.competition_id
      AND competition_participants.user_id = auth.uid()
    )
  );

-- Allow users to see invites for their email
CREATE POLICY "Users can view their own invites" ON competition_invites
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Allow participants to view invites for their competitions
CREATE POLICY "Participants can view competition invites" ON competition_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM competition_participants
      WHERE competition_participants.competition_id = competition_invites.competition_id
      AND competition_participants.user_id = auth.uid()
    )
  );

-- Add function to check and update invite code usage
CREATE OR REPLACE FUNCTION check_and_update_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  -- If there's a code_id
  IF NEW.code_id IS NOT NULL THEN
    -- Check if the code exists and is valid
    IF NOT EXISTS (
      SELECT 1 FROM competition_invite_codes
      WHERE id = NEW.code_id
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR uses < max_uses)
    ) THEN
      RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;
    
    -- Update the uses count
    UPDATE competition_invite_codes
    SET uses = uses + 1
    WHERE id = NEW.code_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invite code usage
CREATE TRIGGER check_invite_code
BEFORE INSERT ON competition_invites
FOR EACH ROW
EXECUTE FUNCTION check_and_update_invite_code();
