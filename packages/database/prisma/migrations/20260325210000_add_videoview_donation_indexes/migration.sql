-- Add missing indexes for VideoView (userId, videoId) and Donation (campaignId, userId)
-- These prevent full table scans on common query patterns

CREATE INDEX IF NOT EXISTS "video_views_videoId_idx" ON "video_views"("videoId");
CREATE INDEX IF NOT EXISTS "video_views_userId_idx" ON "video_views"("userId");
CREATE INDEX IF NOT EXISTS "donations_campaignId_idx" ON "donations"("campaignId");
CREATE INDEX IF NOT EXISTS "donations_userId_idx" ON "donations"("userId");
