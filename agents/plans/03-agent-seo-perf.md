# Plan 03: Agent-Friendly Auth, SSR/SEO, Performance Fixes

## Context

Automated agents visiting hallofshame.cc cannot:
- View page content (SSR disabled → empty HTML shell)
- Register or authenticate (WebAuthn-only)
- Create posts (no JWT without auth)

Additionally:
- Copy backup code button has no feedback animation
- Page feels slow due to LiveConnection retry storms blocking real API calls
- Posts are not indexable by search engines (no SSR, no meta tags)

## Goals

1. **Personal API Keys (PAK)** — let passkey-verified humans generate API keys agents can use
2. **SSR + SEO** — enable server-side rendering, add proper meta tags, make posts shareable
3. **UX: "Too lazy to post?" flow** — guide humans to create API keys for agents
4. **UX: Copy feedback** — green "Copied!" animation on backup code copy
5. **Performance fixes** — fix LiveConnection retry storms, memoize markdown, reduce initial render

## Non-Goals

- Replace SvelteKit, Cloudflare Workers, or Durable Objects
- Remove passkey auth
- Add email/password auth
- Full admin panel

---

## Phase A: Database & API Key Infrastructure

### A1. Migration: `api_keys` table

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL DEFAULT '',
  key_prefix TEXT NOT NULL,          -- first 8 chars for display: "pak_Ab3x..."
  key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 hash of the full key
  last_used_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### A2. Server: API key verification

In `src/lib/server/auth.ts`:
- Add `verifyApiKey(key, db)` — hash key, look up in DB, check expiry, return `{ sub, username }`
- Add `createApiKey(userId, name, db)` — generate `pak_<nanoid(48)>`, hash, store, return the key (shown once)
- Add `listApiKeys(userId, db)` — return keys with prefix, name, last_used, expires
- Add `deleteApiKey(keyId, userId, db)` — revoke

### A3. Middleware update

In `src/lib/server/middleware.ts` → `guardPost()`:
- After JWT check fails, try API key: `getAuthUser()` → fallback to `getApiKeyUser()`
- Same for `guardGet()` optional auth

### A4. API routes

New: `src/routes/api/auth/api-keys/+server.ts`
- `GET` — list user's keys (requires JWT or API key auth)
- `POST` — create new key (requires JWT auth only — can't create a key with a key)
- `DELETE` — revoke a key by ID

Limits: max 3 keys per user, 90-day expiry.

---

## Phase B: SSR + SEO

### B1. Enable SSR

Change `src/routes/+layout.ts`:
```ts
export const ssr = true;   // was false
export const prerender = false;
```

### B2. Server-side data loading

Add load functions for SSR:
- `src/routes/+page.server.ts` — load initial posts server-side
- `src/routes/post/[id]/+page.server.ts` — load post data server-side (for meta tags)

### B3. Meta tags for posts

In `src/routes/post/[id]/+page.svelte`:
- `<svelte:head>` with Open Graph, Twitter Card meta
- `og:title`, `og:description` (first 200 chars of body, stripped of markdown)
- `og:url`, `og:type=article`

### B4. Root layout meta

In `src/routes/+layout.svelte` or `app.html`:
- Default OG/Twitter meta for homepage
- Structured data (JSON-LD) for WebSite

### B5. Sitemap & robots.txt

- `src/routes/sitemap.xml/+server.ts` — dynamic sitemap of all active posts
- `src/routes/robots.txt/+server.ts` — allow all crawlers

---

## Phase C: UI Enhancements

### C1. "Too lazy to post?" button

On the homepage (near the submit button or empty state), add a small secondary action:
- Collapsed: "🤖 Too lazy to post yourself?" link/button
- Expanded: shows:
  1. Create an API key in Profile Settings
  2. Give the key to your AI agent
  3. Agent uses the API documented at /skill.md
- Links to open profile modal (API keys section)

### C2. API Key Management in ProfileModal

Add a section in `ProfileModal.svelte`:
- List existing keys (prefix, name, created, last used)
- "Create Key" button → name input → shows key once → copy
- "Revoke" button per key
- Max 3 keys indicator

### C3. Copy feedback on BackupCodeModal

In `BackupCodeModal.svelte`:
- After `copyCode()`, show green border + "Copied!" text
- Auto-reset after 2 seconds

### C4. Update skill.md

Add API key auth section explaining:
- How to get a key from a human
- Using `Authorization: Bearer pak_...`
- Key limits and expiration
- Clear instructions for agent bootstrap

---

## Phase D: Performance Fixes

### D1. Memoize markdown on post detail page

In `src/routes/post/[id]/+page.svelte`:
- Cache `renderedBody` — only re-parse when `post.body` changes, not on vote/reaction live events

### D2. Reduce initial page size

In `src/routes/+page.svelte`:
- Change `PAGE_SIZE` from 50 to 20

### D3. Add stale-response guard

In `src/routes/+page.svelte`:
- Track fetch generation to discard stale responses from fast sort switching

---

## Implementation Order

1. Phase D (performance) — immediate UX improvement
2. Phase A (API keys) — infrastructure for everything else
3. Phase C (UI) — API key management, copy feedback, "too lazy" button
4. Phase B (SSR/SEO) — enable SSR, meta tags, server load functions
5. Update skill.md and deploy
