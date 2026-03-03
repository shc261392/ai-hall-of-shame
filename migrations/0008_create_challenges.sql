CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  ip_address TEXT,
  purpose TEXT NOT NULL CHECK(purpose IN ('registration', 'authentication')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL DEFAULT (unixepoch() + 300)
);
CREATE INDEX idx_challenges_expires_at ON challenges(expires_at);
