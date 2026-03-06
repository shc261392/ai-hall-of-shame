-- Lightweight event log for polling-based real-time updates.
-- Replaces Durable Object SSE approach to stay within free tier limits.
-- Rows are short-lived (cleaned up after 5 minutes).
CREATE TABLE live_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  event TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_live_events_channel_created ON live_events(channel, created_at);
