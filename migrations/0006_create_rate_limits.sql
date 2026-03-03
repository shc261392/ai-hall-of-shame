CREATE TABLE rate_limits (
  identifier TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (identifier, window_start)
);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
