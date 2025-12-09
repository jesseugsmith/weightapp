-- Webapp Database Migration Script
-- Run this in Supabase SQL Editor to set up required tables for new features

-- ============================================================================
-- MATCHMAKING SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.competition_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status IN ('pending', 'matched', 'cancelled')),
  joined_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'UTC'::text),
  match_date timestamp with time zone,
  matched_with uuid[],
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_competition_queue_user_id 
  ON public.competition_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_queue_competition_id 
  ON public.competition_queue(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_queue_status 
  ON public.competition_queue(status);

-- ============================================================================
-- SOCIAL ACTIVITY FEED
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  activity_value numeric NOT NULL,
  activity_unit text,
  description text,
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  like_count integer DEFAULT 0,
  comment_count integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.activity_post_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_post_id uuid NOT NULL REFERENCES public.activity_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  UNIQUE(activity_post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.activity_post_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_post_id uuid NOT NULL REFERENCES public.activity_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Add indexes for social features
CREATE INDEX IF NOT EXISTS idx_activity_posts_user_id 
  ON public.activity_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_posts_created_at 
  ON public.activity_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_posts_competition_id 
  ON public.activity_posts(competition_id);
CREATE INDEX IF NOT EXISTS idx_activity_post_likes_post_id 
  ON public.activity_post_likes(activity_post_id);
CREATE INDEX IF NOT EXISTS idx_activity_post_comments_post_id 
  ON public.activity_post_comments(activity_post_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id 
  ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id 
  ON public.user_follows(following_id);

-- ============================================================================
-- NOTIFICATIONS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

-- Add indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read 
  ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  maintenance_mode boolean DEFAULT false,
  feature_matchmaking_enabled boolean DEFAULT true,
  feature_social_feed_enabled boolean DEFAULT true,
  feature_public_competitions_enabled boolean DEFAULT true,
  feature_api_tokens_enabled boolean DEFAULT true,
  max_active_competitions_per_user integer DEFAULT 5,
  max_message_length integer DEFAULT 500,
  max_post_length integer DEFAULT 1000,
  created_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
  updated_at timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text)
);

-- ============================================================================
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Add is_matchmaking flag to competitions if it doesn't exist
ALTER TABLE public.competitions 
  ADD COLUMN IF NOT EXISTS is_matchmaking boolean DEFAULT false;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.competition_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Competition Queue RLS
DROP POLICY IF EXISTS "Users can view their own queue entries" ON public.competition_queue;
CREATE POLICY "Users can view their own queue entries"
  ON public.competition_queue FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own queue entries" ON public.competition_queue;
CREATE POLICY "Users can insert their own queue entries"
  ON public.competition_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own queue entries" ON public.competition_queue;
CREATE POLICY "Users can update their own queue entries"
  ON public.competition_queue FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Activity Posts RLS
DROP POLICY IF EXISTS "Anyone can view activity posts" ON public.activity_posts;
CREATE POLICY "Anyone can view activity posts"
  ON public.activity_posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create their own posts" ON public.activity_posts;
CREATE POLICY "Users can create their own posts"
  ON public.activity_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.activity_posts;
CREATE POLICY "Users can update their own posts"
  ON public.activity_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Activity Post Likes RLS
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.activity_post_likes;
CREATE POLICY "Anyone can view post likes"
  ON public.activity_post_likes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can like posts" ON public.activity_post_likes;
CREATE POLICY "Users can like posts"
  ON public.activity_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike their own likes" ON public.activity_post_likes;
CREATE POLICY "Users can unlike their own likes"
  ON public.activity_post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Activity Post Comments RLS
DROP POLICY IF EXISTS "Anyone can view comments" ON public.activity_post_comments;
CREATE POLICY "Anyone can view comments"
  ON public.activity_post_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can comment on posts" ON public.activity_post_comments;
CREATE POLICY "Users can comment on posts"
  ON public.activity_post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can edit their own comments" ON public.activity_post_comments;
CREATE POLICY "Users can edit their own comments"
  ON public.activity_post_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Follows RLS
DROP POLICY IF EXISTS "Anyone can view follows" ON public.user_follows;
CREATE POLICY "Anyone can view follows"
  ON public.user_follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.user_follows;
CREATE POLICY "Users can follow others"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow" ON public.user_follows;
CREATE POLICY "Users can unfollow"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Notifications RLS
DROP POLICY IF EXISTS "Users can only see their own notifications" ON public.notifications;
CREATE POLICY "Users can only see their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System Settings RLS
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings"
  ON public.system_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can update system settings" ON public.system_settings;
CREATE POLICY "Only admins can update system settings"
  ON public.system_settings FOR UPDATE
  USING (EXISTS(SELECT 1 FROM public.admin WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.admin WHERE user_id = auth.uid()));

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING COUNTS
-- ============================================================================

-- Function to update activity_posts like_count
DROP FUNCTION IF EXISTS public.update_activity_post_like_count() CASCADE;
CREATE FUNCTION public.update_activity_post_like_count()
  RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.activity_posts 
    SET like_count = like_count + 1,
        updated_at = now()
    WHERE id = NEW.activity_post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.activity_posts 
    SET like_count = GREATEST(like_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.activity_post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_post_like_count_trigger ON public.activity_post_likes;
CREATE TRIGGER activity_post_like_count_trigger
  AFTER INSERT OR DELETE ON public.activity_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_activity_post_like_count();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default system settings if not exists
INSERT INTO public.system_settings (id)
  VALUES (gen_random_uuid())
  ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify tables were created successfully:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
--   AND tablename IN (
--     'competition_queue', 
--     'activity_posts', 
--     'activity_post_likes',
--     'activity_post_comments',
--     'user_follows',
--     'notifications',
--     'system_settings'
--   );
