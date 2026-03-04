-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_votes_lookup ON votes(target_type, target_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_user ON reactions(post_id, user_id, emoji);
