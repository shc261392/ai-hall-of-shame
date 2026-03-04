-- Soft-delete support
ALTER TABLE posts ADD COLUMN deleted_at INTEGER DEFAULT NULL;
ALTER TABLE comments ADD COLUMN deleted_at INTEGER DEFAULT NULL;

-- Report counts for auto-hide threshold
ALTER TABLE posts ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;

-- Abuse reports table
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(target_type, target_id, user_id)
);

CREATE INDEX idx_reports_target ON reports(target_type, target_id);
