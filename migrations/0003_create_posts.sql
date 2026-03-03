CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_score ON posts((upvotes - downvotes) DESC);
CREATE INDEX idx_posts_user_id ON posts(user_id);
