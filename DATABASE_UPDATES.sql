-- Mukkaz Database Schema Updates
-- Run these SQL commands to add new features

-- ============================================
-- 1. UPDATE COMMENTS TABLE FOR THREADING
-- ============================================

-- Add parent_comment_id for nested comments
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Add likes_count for performance
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

-- ============================================
-- 2. SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  channel_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(subscriber_id, channel_id)
);

-- Add subscribers_count to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscribers_count INTEGER DEFAULT 0;

-- ============================================
-- 3. BOOKMARKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, video_id)
);

-- ============================================
-- 4. COMMENT_LIKES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, comment_id)
);

-- ============================================
-- 5. NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'video_like', 'video_comment', 'comment_like', 'comment_reply', 'new_subscriber', 'new_video'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- URL to navigate to
  is_read BOOLEAN DEFAULT false,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Who triggered the notification
  related_video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  related_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- 6. SEARCH_HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);

-- ============================================
-- 7. UPDATE VIDEOS TABLE
-- ============================================

-- Add likes and dislikes count for performance
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;

ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- ============================================
-- 8. ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. POLICIES FOR SUBSCRIPTIONS
-- ============================================

DROP POLICY IF EXISTS "Subscriptions are viewable by everyone" ON subscriptions;
DROP POLICY IF EXISTS "Users can subscribe" ON subscriptions;
DROP POLICY IF EXISTS "Users can unsubscribe" ON subscriptions;

CREATE POLICY "Subscriptions are viewable by everyone"
ON subscriptions FOR SELECT
USING (true);

CREATE POLICY "Users can subscribe"
ON subscriptions FOR INSERT
WITH CHECK (auth.uid() = subscriber_id);

CREATE POLICY "Users can unsubscribe"
ON subscriptions FOR DELETE
USING (auth.uid() = subscriber_id);

-- ============================================
-- 10. POLICIES FOR BOOKMARKS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can create bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete their own bookmarks" ON bookmarks;

CREATE POLICY "Users can view their own bookmarks"
ON bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookmarks"
ON bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
ON bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 11. POLICIES FOR COMMENT_LIKES
-- ============================================

DROP POLICY IF EXISTS "Comment likes are viewable by everyone" ON comment_likes;
DROP POLICY IF EXISTS "Users can like comments" ON comment_likes;
DROP POLICY IF EXISTS "Users can unlike comments" ON comment_likes;

CREATE POLICY "Comment likes are viewable by everyone"
ON comment_likes FOR SELECT
USING (true);

CREATE POLICY "Users can like comments"
ON comment_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments"
ON comment_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 12. POLICIES FOR NOTIFICATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow authenticated users to create notifications (for other users)
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- ============================================
-- 13. POLICIES FOR SEARCH_HISTORY
-- ============================================

DROP POLICY IF EXISTS "Users can view their own search history" ON search_history;
DROP POLICY IF EXISTS "Users can create search history" ON search_history;
DROP POLICY IF EXISTS "Users can delete their own search history" ON search_history;

CREATE POLICY "Users can view their own search history"
ON search_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create search history"
ON search_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history"
ON search_history FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- 14. HELPER FUNCTIONS
-- ============================================

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_related_video_id UUID DEFAULT NULL,
  p_related_comment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, actor_id, related_video_id, related_comment_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_actor_id, p_related_video_id, p_related_comment_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Function to increment likes count on video
CREATE OR REPLACE FUNCTION increment_video_likes(p_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE videos SET likes_count = likes_count + 1 WHERE id = p_video_id;
END;
$$;

-- Function to decrement likes count on video
CREATE OR REPLACE FUNCTION decrement_video_likes(p_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_video_id;
END;
$$;

-- Function to increment comment likes count
CREATE OR REPLACE FUNCTION increment_comment_likes(p_comment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE comments SET likes_count = likes_count + 1 WHERE id = p_comment_id;
END;
$$;

-- Function to decrement comment likes count
CREATE OR REPLACE FUNCTION decrement_comment_likes(p_comment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = p_comment_id;
END;
$$;

-- Function to increment comments count on video
CREATE OR REPLACE FUNCTION increment_comments_count(p_video_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE videos SET comments_count = comments_count + 1 WHERE id = p_video_id;
END;
$$;

-- Function to increment subscribers count
CREATE OR REPLACE FUNCTION increment_subscribers_count(p_channel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET subscribers_count = subscribers_count + 1 WHERE id = p_channel_id;
END;
$$;

-- Function to decrement subscribers count
CREATE OR REPLACE FUNCTION decrement_subscribers_count(p_channel_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id = p_channel_id;
END;
$$;
