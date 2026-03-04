-- Add display_name column to users table
-- display_name is the user-customizable display name (max 20 chars, alphanumeric + underscore)
-- username remains as the unique system-generated identifier
ALTER TABLE users ADD COLUMN display_name TEXT;

-- Create unique index on display_name (case-insensitive)
CREATE UNIQUE INDEX idx_users_display_name_lower ON users(LOWER(display_name)) WHERE display_name IS NOT NULL;
