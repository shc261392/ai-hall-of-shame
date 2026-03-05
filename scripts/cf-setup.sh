#!/usr/bin/env bash
# scripts/cf-setup.sh — One-time Cloudflare infrastructure setup
# Requires: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env
set -euo pipefail

if [ ! -f .env ]; then
  echo "❌ .env not found. Copy .env.example to .env and fill in your values first."
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "❌ CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set in .env"
  exit 1
fi

export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

echo "🔧 Creating D1 database..."
DB_OUTPUT=$(npx wrangler d1 create ahos-db 2>&1 || true)
echo "$DB_OUTPUT"

# Extract database_id from output
DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || true)
if [ -n "$DB_ID" ]; then
  echo "✅ Database ID: $DB_ID"
  sed -i "s/placeholder-set-after-db-creation/$DB_ID/" wrangler.toml
  echo "✅ Updated wrangler.toml with database ID"
else
  echo "⚠️  Could not extract database_id — database may already exist."
  echo "    Check wrangler.toml and update database_id manually if needed."
fi

echo ""
echo "🗄️  Running D1 migrations..."
# If the DB has tables but d1_migrations is empty/missing, seed the tracking table.
# This handles databases set up before (or with a broken) wrangler migrations apply run.
USERS_EXISTS=$(CI=true npx wrangler d1 execute ahos-db --remote \
  --command "SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name='users';" \
  --json 2>/dev/null | grep -oP '"n":\s*\K[0-9]+' || echo "0")
TRACKED_COUNT=$(CI=true npx wrangler d1 execute ahos-db --remote \
  --command "SELECT count(*) as n FROM d1_migrations;" \
  --json 2>/dev/null | grep -oP '"n":\s*\K[0-9]+' || echo "0")
if [ "$USERS_EXISTS" = "1" ] && [ "$TRACKED_COUNT" = "0" ]; then
  echo "  ⚙️  Seeding migration tracking for pre-existing database..."
  SEED_SQL="CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);"
  for migration in migrations/*.sql; do
    name=$(basename "$migration")
    SEED_SQL="$SEED_SQL INSERT OR IGNORE INTO d1_migrations (name) VALUES ('$name');"
  done
  CI=true npx wrangler d1 execute ahos-db --remote --command "$SEED_SQL"
fi
CI=true npx wrangler d1 migrations apply ahos-db --remote

echo ""
echo "🔑 Setting secrets..."
if [ -n "${JWT_SECRET:-}" ]; then
  echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
else
  echo "⚠️  JWT_SECRET not set in .env — generate one and set it:"
  echo '    openssl rand -base64 48 | npx wrangler secret put JWT_SECRET'
fi

if [ -n "${WEBAUTHN_RP_ID:-}" ]; then
  echo "$WEBAUTHN_RP_ID" | npx wrangler secret put WEBAUTHN_RP_ID
fi

if [ -n "${WEBAUTHN_RP_NAME:-}" ]; then
  echo "$WEBAUTHN_RP_NAME" | npx wrangler secret put WEBAUTHN_RP_NAME
fi

echo ""
echo "✅ Setup complete! Run 'pnpm deploy' to deploy."
