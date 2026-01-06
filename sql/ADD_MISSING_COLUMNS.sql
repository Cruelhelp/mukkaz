-- Add Missing Columns to Videos Table for Cloudflare Stream Support
-- Run this in your Supabase SQL Editor

-- ============================================
-- ADD MISSING COLUMNS TO VIDEOS TABLE
-- ============================================

-- Add tags column (for video tags/categories)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS tags TEXT;

-- Add duration column (video length in seconds)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS duration INTEGER;

-- Add resolution column (video resolution, e.g., "1920x1080")
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS resolution TEXT;

-- Add is_public column (visibility control)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add stream_id column (for Cloudflare Stream videos)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS stream_id TEXT;

-- Add stream_url column (for Cloudflare Stream HLS URL)
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- ============================================
-- UPDATE EXISTING CONSTRAINT (if needed)
-- ============================================

-- Make 'url' nullable since Cloudflare videos use stream_url instead
ALTER TABLE videos
ALTER COLUMN url DROP NOT NULL;

-- ============================================
-- ADD CHECK CONSTRAINT
-- ============================================

-- Ensure either url OR stream_url is provided (not both null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'videos_url_or_stream_url_check'
  ) THEN
    ALTER TABLE videos
    ADD CONSTRAINT videos_url_or_stream_url_check
    CHECK (url IS NOT NULL OR stream_url IS NOT NULL);
  END IF;
END $$;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_videos_stream_id ON videos(stream_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_public ON videos(is_public);
CREATE INDEX IF NOT EXISTS idx_videos_tags ON videos USING gin(to_tsvector('english', tags));

-- ============================================
-- VERIFY CHANGES
-- ============================================

-- Run this to verify columns were added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'videos'
-- ORDER BY ordinal_position;
