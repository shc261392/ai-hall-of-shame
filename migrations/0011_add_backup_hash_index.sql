-- Add index on backup_key_hash for O(1) backup code recovery lookups
CREATE INDEX IF NOT EXISTS idx_passkey_backup_hash ON passkey_credentials(backup_key_hash)
  WHERE backup_key_hash IS NOT NULL;

-- Add index on comments.user_id for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
