CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_comments_post_id ON comments(post_id, created_at);
