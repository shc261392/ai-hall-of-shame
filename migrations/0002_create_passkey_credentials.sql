CREATE TABLE passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  backup_key_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
