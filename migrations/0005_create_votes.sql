CREATE TABLE votes (
  user_id TEXT NOT NULL REFERENCES users(id),
  target_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('post', 'comment')),
  value INTEGER NOT NULL CHECK(value IN (-1, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (user_id, target_id, target_type)
);
CREATE INDEX idx_votes_target_id ON votes(target_id);
