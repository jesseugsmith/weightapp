-- ============================================================================
-- FITCLASH DATABASE SCHEMA
-- ============================================================================
-- Complete database setup for FitClash weight tracking and competition app

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  avatar TEXT,
  phone TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  height DECIMAL(5,2),
  bio TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  weight_unit TEXT CHECK (weight_unit IN ('lbs', 'kg')) DEFAULT 'lbs',
  push_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(active);

-- ============================================================================
-- WEIGHT ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.weight_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  body_fat_percentage DECIMAL(5,2),
  muscle_mass DECIMAL(5,2),
  notes TEXT,
  image_url TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON public.weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON public.weight_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON public.weight_entries(date DESC);

-- ============================================================================
-- COMPETITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('draft', 'started', 'completed', 'cancelled')) DEFAULT 'draft' NOT NULL,
  competition_type TEXT CHECK (competition_type IN ('weight_loss', 'weight_gain', 'body_fat_loss', 'muscle_gain')),
  activity_type TEXT CHECK (activity_type IN ('weight', 'steps', 'distance', 'calories', 'custom')) DEFAULT 'weight',
  ranking_direction TEXT CHECK (ranking_direction IN ('asc', 'desc')) DEFAULT 'desc',
  max_participants INTEGER,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competitions_created_by ON public.competitions(created_by);
CREATE INDEX IF NOT EXISTS idx_competitions_status ON public.competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_dates ON public.competitions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_competitions_invite_code ON public.competitions(invite_code);

-- ============================================================================
-- COMPETITION PARTICIPANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  starting_weight DECIMAL(5,2),
  current_weight DECIMAL(5,2),
  goal_weight DECIMAL(5,2),
  weight_change DECIMAL(5,2),
  weight_change_percentage DECIMAL(5,2),
  starting_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  value_change DECIMAL(10,2),
  value_change_percentage DECIMAL(5,2),
  total_entries INTEGER DEFAULT 0,
  last_entry_date TIMESTAMP WITH TIME ZONE,
  rank INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT competition_participants_unique UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_participants_competition ON public.competition_participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_user ON public.competition_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_participants_rank ON public.competition_participants(competition_id, rank);

-- ============================================================================
-- ACTIVITY ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_entries_user_type ON public.activity_entries(user_id, activity_type, date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entries_date ON public.activity_entries(date DESC);

-- ============================================================================
-- PRIZES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prizes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER NOT NULL,
  prize_amount DECIMAL(10,2) DEFAULT 0,
  prize_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT prizes_unique_rank UNIQUE (competition_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_prizes_competition ON public.prizes(competition_id, rank);

-- ============================================================================
-- COMPETITION WINNERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER NOT NULL,
  prize_amount DECIMAL(10,2) DEFAULT 0,
  prize_description TEXT,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT competition_winners_unique UNIQUE (competition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_winners_competition ON public.competition_winners(competition_id, rank);
CREATE INDEX IF NOT EXISTS idx_competition_winners_user ON public.competition_winners(user_id);

-- ============================================================================
-- COMPETITION INVITE CODES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_competition ON public.competition_invite_codes(competition_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.competition_invite_codes(code);

-- ============================================================================
-- COMPETITION INVITES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  invitee_email TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  invite_token TEXT UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_competition ON public.competition_invites(competition_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.competition_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.competition_invites(invite_token);

-- ============================================================================
-- COMPETITION MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  parent_message_id UUID REFERENCES public.competition_messages(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('message', 'announcement', 'system')) DEFAULT 'message' NOT NULL,
  mentioned_users UUID[] DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competition_messages_competition ON public.competition_messages(competition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competition_messages_user ON public.competition_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_messages_parent ON public.competition_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_competition_messages_mentions ON public.competition_messages USING GIN(mentioned_users);
CREATE INDEX IF NOT EXISTS idx_competition_messages_active ON public.competition_messages(competition_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- MESSAGE REACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.competition_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON public.message_reactions(user_id);

-- ============================================================================
-- MESSAGE READ RECEIPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.competition_messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  
  CONSTRAINT message_read_receipts_unique UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON public.message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user ON public.message_read_receipts(user_id);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Profiles policies
CREATE POLICY "Authenticated users can view basic profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Weight entries policies
CREATE POLICY "Users can view their own weight entries"
  ON public.weight_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight entries"
  ON public.weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight entries"
  ON public.weight_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight entries"
  ON public.weight_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Activity entries policies
CREATE POLICY "Users can view their own activity entries"
  ON public.activity_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity entries"
  ON public.activity_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity entries"
  ON public.activity_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activity entries"
  ON public.activity_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Competitions policies
CREATE POLICY "Anyone can view competitions"
  ON public.competitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create competitions"
  ON public.competitions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their competitions"
  ON public.competitions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their competitions"
  ON public.competitions FOR DELETE
  USING (auth.uid() = created_by);

-- Competition participants policies
CREATE POLICY "Anyone can view competition participants"
  ON public.competition_participants FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join competitions"
  ON public.competition_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their participation"
  ON public.competition_participants FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.competitions 
    WHERE id = competition_id AND created_by = auth.uid()
  ));

-- Prizes policies
CREATE POLICY "Anyone can view prizes"
  ON public.prizes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Competition creators can manage prizes"
  ON public.prizes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.competitions 
    WHERE id = competition_id AND created_by = auth.uid()
  ));

-- Competition messages policies
CREATE POLICY "Participants can view competition messages"
  ON public.competition_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.competition_participants cp
    WHERE cp.competition_id = competition_messages.competition_id 
    AND cp.user_id = auth.uid() 
    AND cp.is_active = true
  ));

CREATE POLICY "Participants can send messages"
  ON public.competition_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.competition_participants cp
      WHERE cp.competition_id = competition_messages.competition_id 
      AND cp.user_id = auth.uid() 
      AND cp.is_active = true
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.competition_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Message reactions policies
CREATE POLICY "Participants can view reactions"
  ON public.message_reactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.competition_messages cm
    JOIN public.competition_participants cp ON cm.competition_id = cp.competition_id
    WHERE cm.id = message_reactions.message_id 
    AND cp.user_id = auth.uid() 
    AND cp.is_active = true
  ));

CREATE POLICY "Participants can react to messages"
  ON public.message_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.competition_messages cm
      JOIN public.competition_participants cp ON cm.competition_id = cp.competition_id
      WHERE cm.id = message_reactions.message_id 
      AND cp.user_id = auth.uid() 
      AND cp.is_active = true
    )
  );

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update competition participant stats
CREATE OR REPLACE FUNCTION update_competition_leaderboards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  competition_record RECORD;
  participant_record RECORD;
  calculated_change DECIMAL(10,2);
  calculated_percentage DECIMAL(5,2);
  new_rank INTEGER;
BEGIN
  -- Update leaderboard for all active competitions this user is participating in
  FOR competition_record IN 
    SELECT c.id, c.competition_type, c.activity_type, c.ranking_direction
    FROM public.competitions c
    JOIN public.competition_participants cp ON c.id = cp.competition_id
    WHERE cp.user_id = NEW.user_id
    AND cp.is_active = true
    AND c.status IN ('started', 'draft')
  LOOP
    -- Get participant record
    SELECT * INTO participant_record
    FROM public.competition_participants
    WHERE competition_id = competition_record.id 
    AND user_id = NEW.user_id;
    
    IF FOUND THEN
      -- For weight-based competitions
      IF competition_record.activity_type = 'weight' OR competition_record.competition_type IS NOT NULL THEN
        -- Update current weight and calculate changes
        calculated_change := NEW.weight - COALESCE(participant_record.starting_weight, NEW.weight);
        
        IF participant_record.starting_weight IS NOT NULL AND participant_record.starting_weight != 0 THEN
          calculated_percentage := (calculated_change / participant_record.starting_weight) * 100;
        ELSE
          calculated_percentage := 0;
        END IF;
        
        -- Update participant record
        UPDATE public.competition_participants 
        SET 
          current_weight = NEW.weight,
          weight_change = calculated_change,
          weight_change_percentage = calculated_percentage,
          current_value = NEW.weight,
          value_change = calculated_change,
          value_change_percentage = calculated_percentage,
          total_entries = COALESCE(total_entries, 0) + 1,
          last_entry_date = NEW.date,
          updated_at = now()
        WHERE competition_id = competition_record.id 
        AND user_id = NEW.user_id;
        
        -- Update starting weight if this is the first entry
        IF participant_record.starting_weight IS NULL THEN
          UPDATE public.competition_participants 
          SET 
            starting_weight = NEW.weight,
            starting_value = NEW.weight
          WHERE competition_id = competition_record.id 
          AND user_id = NEW.user_id;
        END IF;
      END IF;
      
      -- Recalculate rankings for this competition
      WITH ranked_participants AS (
        SELECT 
          id,
          CASE 
            WHEN competition_record.competition_type = 'weight_loss' OR 
                 (competition_record.activity_type = 'weight' AND competition_record.ranking_direction = 'asc') 
            THEN ROW_NUMBER() OVER (ORDER BY weight_change ASC NULLS LAST)
            ELSE ROW_NUMBER() OVER (ORDER BY weight_change DESC NULLS LAST)
          END as new_rank
        FROM public.competition_participants
        WHERE competition_id = competition_record.id 
        AND is_active = true
        AND current_weight IS NOT NULL
      )
      UPDATE public.competition_participants 
      SET rank = rp.new_rank
      FROM ranked_participants rp
      WHERE public.competition_participants.id = rp.id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for weight entries
CREATE OR REPLACE TRIGGER trigger_update_leaderboards
AFTER INSERT ON public.weight_entries
FOR EACH ROW
EXECUTE FUNCTION update_competition_leaderboards();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();