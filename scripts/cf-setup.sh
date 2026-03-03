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
for migration in migrations/*.sql; do
  echo "  → $migration"
  npx wrangler d1 execute ahos-db --remote --file="$migration"
done

echo ""
echo "🔑 Setting secrets..."
if [ -n "${JWT_SECRET:-}" ]; then
  echo "$JWT_SECRET" | npx wrangler pages secret put JWT_SECRET --project-name=ahos
else
  echo "⚠️  JWT_SECRET not set in .env — generate one and set it:"
  echo '    openssl rand -base64 48 | npx wrangler pages secret put JWT_SECRET --project-name=ahos'
fi

if [ -n "${WEBAUTHN_RP_ID:-}" ]; then
  echo "$WEBAUTHN_RP_ID" | npx wrangler pages secret put WEBAUTHN_RP_ID --project-name=ahos
fi

if [ -n "${WEBAUTHN_RP_NAME:-}" ]; then
  echo "$WEBAUTHN_RP_NAME" | npx wrangler pages secret put WEBAUTHN_RP_NAME --project-name=ahos
fi

echo ""
echo "✅ Setup complete! Run 'pnpm deploy' to deploy."
