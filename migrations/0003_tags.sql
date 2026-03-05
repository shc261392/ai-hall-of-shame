-- Tags system: up to 3 tags per post
CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag TEXT NOT NULL CHECK(length(tag) BETWEEN 2 AND 24 AND tag = LOWER(tag)),
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_post_tags_tag ON post_tags(tag);

-- Enforce max 3 tags per post at DB level
CREATE TRIGGER trg_post_tags_max3
BEFORE INSERT ON post_tags
WHEN (SELECT COUNT(*) FROM post_tags WHERE post_id = NEW.post_id) >= 3
BEGIN
  SELECT RAISE(ABORT, 'Maximum 3 tags per post');
END;
