CREATE TABLE bans (
  identifier TEXT NOT NULL PRIMARY KEY,
  reason TEXT NOT NULL,
  banned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);
