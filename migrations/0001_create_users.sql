CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
