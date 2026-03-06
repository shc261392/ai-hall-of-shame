-- Add source column to distinguish AI-generated tags from user-created tags
ALTER TABLE post_tags ADD COLUMN source TEXT NOT NULL DEFAULT 'ai' CHECK(source IN ('user', 'ai'));
