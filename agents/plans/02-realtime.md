# AHOS Phase 2 — Real-time, Auth Hardening, Performance & Backlog Sweep

> **Goal**: Ship short-lived JWTs with transparent refresh, "remember me" toggle, infinite scroll, DB query batching, Cloudflare-native caching, and lightweight real-time updates for posts/votes/reactions — all with smooth CSS animations. Sweep remaining medium backlog items where possible.

---

## Table of Contents

1. [Auth: Short-lived JWT + Refresh Token](#1-auth-short-lived-jwt--refresh-token)
2. [Auth: Remember This Device Toggle](#2-auth-remember-this-device-toggle)
3. [Pagination: Infinite Scroll](#3-pagination-infinite-scroll)
4. [DB Query Batching](#4-db-query-batching)
5. [Cloudflare Caching](#5-cloudflare-caching)
6. [Real-time Updates](#6-real-time-updates)
7. [CSS Animations for Live Updates](#7-css-animations-for-live-updates)
8. [Additional Backlog Items Addressed](#8-additional-backlog-items-addressed)
9. [Testing Strategy](#9-testing-strategy)
10. [Implementation Order](#10-implementation-order)

---

## 1. Auth: Short-lived JWT + Refresh Token

### Problem
JWTs are currently valid for 7 days with no revocation. A stolen token gives an attacker a 7-day window.

### Solution
- **Access token**: 15-minute expiry (`exp`), signed with HS256 + `JWT_SECRET`
- **Refresh token**: opaque token (nanoid), stored in D1 `refresh_tokens` table
  - 30-day expiry for "remember me", session-scoped otherwise
  - Hashed in DB (SHA-256) so a DB leak doesn't compromise sessions
- **Token rotation**: each refresh issues a new refresh token + access token (old refresh token invalidated)
- **Revocation**: DELETE `/api/auth/refresh` invalidates the refresh token (logout)

### DB Migration
```sql
-- 0014_create_refresh_tokens.sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### API Changes

| Endpoint | Method | Change |
|----------|--------|--------|
| `/api/auth/register` | POST | Return `{ token, refreshToken, expiresIn: 900, ... }` |
| `/api/auth/authenticate` | POST | Return `{ token, refreshToken, expiresIn: 900, ... }` |
| `/api/auth/recover` | POST | Return `{ token, refreshToken, expiresIn: 900, ... }` |
| `/api/auth/refresh` | POST | New — accepts `{ refreshToken }`, returns new token pair |
| `/api/auth/refresh` | DELETE | New — revoke refresh token (logout) |

### Client Changes (auth store + api client)
- Store `refreshToken` + `expiresAt` alongside `token` in auth store
- Storage: `sessionStorage` by default, `localStorage` when "remember me" is on
- `ApiClient` intercepts 401 responses: automatically calls `/api/auth/refresh`, retries original request with new token
- Proactive refresh: schedule refresh ~1 minute before expiry using `setTimeout`
- On refresh failure: clear auth state, show toast "Session expired, please sign in again"

---

## 2. Auth: Remember This Device Toggle

### Problem
Tokens in `sessionStorage` are lost on tab close, frustrating returning users.

### Solution
- Add "Remember this device for 30 days" checkbox to PasskeyAuth modal
- When checked: store auth state in `localStorage` instead of `sessionStorage`, refresh token gets 30-day expiry
- When unchecked: store in `sessionStorage`, refresh token gets 24-hour expiry (session-like)
- On login: pass `{ remember: true/false }` to auth endpoints
- Server sets refresh token expiry accordingly (30 days vs 24 hours)

### UI
- Checkbox below the passkey auth buttons in PasskeyAuth.svelte
- Label: "Remember this device for 30 days"
- Default: unchecked (secure by default)

---

## 3. Pagination: Infinite Scroll

### Problem
Home page loads all posts. Post detail loads all comments. No infinite scroll UX.

### Solution
- **Posts**: 50 per batch (was 20), triggered by `IntersectionObserver` on a sentinel element near bottom
- **Comments**: 50 per batch, same IntersectionObserver approach
- API already supports `page` + `limit` + `has_more` — just need client infinite scroll

### Implementation
- Create `src/lib/utils/infinite-scroll.ts` — Svelte action using IntersectionObserver
- Home page (`+page.svelte`):
  - Change limit from 20 to 50
  - Replace "Load More" button with sentinel `<div>` + `use:infiniteScroll` action
  - Show LoadingSpinner at bottom when fetching next page
- Comment section (`CommentSection.svelte`):
  - Add `page` state, fetch 50 at a time
  - Append to existing comments on scroll
  - Add sentinel at bottom

---

## 4. DB Query Batching

### Problem
`guardPost()` makes 5+ sequential D1 queries: auth verify, 2x ban checks, 2x rate limit checks, auto-ban check. `guardGet()` does 3. This adds latency.

### Solution
Use `db.batch()` to combine queries that don't depend on each other.

### `guardPost()` optimization
```
Phase 1 (parallel): [checkBan(userId), checkBan(ip)]
Phase 2 (parallel): [checkRateLimit(userId), checkRateLimit(ip)]
Phase 3: checkAndAutoBan  (depends on phase 2)
```
Can batch the two ban checks into one `db.batch()` call, and the two rate limit upserts + reads into another.

### `guardGet()` optimization
Currently: ban check → rate limit check → optional auth (sequential)
Batch: ban check + rate limit upsert in one batch, then read rate limit count.

### Rate limit function refactor
Refactor `checkRateLimit` to return prepared statements rather than executing them, so they can be batched by the caller. Or create `batchCheckBans()` and `batchCheckRateLimits()` that accept multiple identifiers.

### Endpoint batching
Some endpoints make multiple sequential queries (e.g., post detail: fetch post, fetch user vote, fetch reaction counts, fetch user reactions). Where possible, batch these read queries.

---

## 5. Cloudflare Caching

### Problem
Current `cachedJson()` sets `Cache-Control: public, max-age=10, s-w-r=30` but doesn't leverage Cloudflare's Cache API or KV for more aggressive caching.

### Solution (lightweight, no KV needed)
- **Cache-Control headers**: Already present, Cloudflare CDN will cache these at the edge automatically when going through CF proxy
- **DELETE/POST invalidation**: Add `Cache-Tag` headers to GET responses, use Cloudflare purge API via `waitUntil()` on mutations — **skipped for now** (requires Enterprise plan for tag-based purge)
- **Practical approach**: Keep short max-age (10s) + stale-while-revalidate (30s). This is already good for Cloudflare's CDN.
- **Add `Vary: Authorization`** header to responses that differ per user (vote status, reactions) so CF caches correctly
- **Static assets**: Cloudflare Pages already serves with immutable cache headers
- **_headers file**: Add long cache for static assets pattern

### Changes
- Add `Vary: Authorization` to `cachedJson()` responses
- Increase stale-while-revalidate to 60s for post lists
- Add `Cache-Control: private, no-cache` to auth endpoints (already implicit, make explicit)

---

## 6. Real-time Updates

### Architecture Decision: SSE Polling via Durable Objects

**Why not WebSocket?**: WebSocket requires a persistent bidirectional connection. For our read-heavy use case (users watching vote counts change), Server-Sent Events (SSE) with Durable Objects provides a simpler, more efficient solution. SSE is unidirectional server-to-client, which matches our pattern perfectly.

**Why Durable Objects?**: Cloudflare Workers are stateless. DOs provide a coordination point where multiple clients can subscribe to updates for the same resource (a post, or the feed). When a mutation happens (vote, reaction, new post), the DO broadcasts to all connected clients.

### Durable Object: `LiveRoom`

A single DO class that manages real-time subscriptions. Clients connect via SSE to `/api/live/:channel` where channel is either `feed` (home page) or `post:{id}` (post detail page).

### How it works

1. **Client connects**: `EventSource('/api/live/feed')` or `EventSource('/api/live/post:abc123')`
2. **SSE endpoint** (Workers Function): Proxies the request to the `LiveRoom` DO via its stub
3. **DO receives connection**: Adds the SSE response to its in-memory subscriber set
4. **Mutation happens**: When a vote/reaction/comment/new-post API call succeeds, the endpoint sends a lightweight notification to the relevant DO
5. **DO broadcasts**: Sends SSE event to all connected subscribers
6. **Client receives**: Updates local state with new counts (does NOT re-fetch — the event carries the delta)

### Event Format
```
event: vote
data: {"postId":"abc","upvotes":12,"downvotes":3}

event: reaction
data: {"postId":"abc","emoji":"🔥","count":5}

event: new_post
data: {"id":"xyz","title":"GPT thinks...","username":"user123","createdAt":1709564400}

event: new_comment
data: {"postId":"abc","commentCount":7}

event: delete
data: {"type":"post","id":"abc"}
```

### Wrangler Config
```toml
[[durable_objects.bindings]]
name = "LIVE_ROOM"
class_name = "LiveRoom"

[[migrations]]
tag = "v1"
new_classes = ["LiveRoom"]
```

### Files to create
- `src/lib/server/live-room.ts` — LiveRoom DO class
- `src/routes/api/live/[channel]/+server.ts` — SSE endpoint (proxies to DO)
- `src/lib/utils/live.ts` — Client-side EventSource manager with auto-reconnect
- `src/lib/stores/live.ts` — Svelte store that merges live events into UI state

### Fallback (no DO available / local dev)
- **Local dev**: Use a simple polling fallback (fetch updates every 15s)
- **Detection**: Check `platform.env.LIVE_ROOM` binding exists. If not, SSE endpoint returns 404 and client falls back to polling.
- The `live.ts` client automatically falls back to polling when SSE fails.

### Mutation notification flow
After a successful vote/reaction/comment/post:
```typescript
// In the API endpoint, after DB write:
const liveRoom = platform.env.LIVE_ROOM;
if (liveRoom) {
  const id = liveRoom.idFromName(channel);
  const stub = liveRoom.get(id);
  event.platform.context.waitUntil(
    stub.fetch('https://do/broadcast', {
      method: 'POST',
      body: JSON.stringify({ event: 'vote', data: { postId, upvotes, downvotes } })
    })
  );
}
```

---

## 7. CSS Animations for Live Updates

### Vote Count Animation
- When vote count changes from live update, the number briefly scales up (1.0 → 1.3 → 1.0) with color flash
- CSS: `@keyframes countBump` with `transform: scale(1.3)` and color transition
- Triggered by adding a `.bumped` class temporarily via Svelte `$effect`

### Reaction Count Animation
- Same bump animation on reaction count change
- Newly added reactions slide in from left with `@keyframes slideInLeft`

### New Post Animation
- New posts at top of feed slide down with `@keyframes slideDown` + fade in
- Existing posts smoothly shift down (handled by Svelte's `{#each}` with `animate:flip`)

### New Comment Animation
- New comments fade in + slide up from bottom
- `@keyframes fadeSlideUp`

### Implementation
- Add animations to `app.css` with `prefers-reduced-motion` respect
- Components add/remove animation classes based on live update events
- Use Svelte's `animate:flip` for list reordering
- All animations are 200-300ms, subtle, not distracting

---

## 8. Additional Backlog Items Addressed

| Backlog Item | Resolution |
|---|---|
| JWT Revocation Mechanism | Short-lived tokens + refresh token rotation (Section 1) |
| Session Storage Fragility | "Remember me" toggle with localStorage option (Section 2) |
| No Pagination on Home Page | Infinite scroll with 50-item batches (Section 3) |
| DB Query Batching | `db.batch()` in guards + endpoints (Section 4) |
| No WebSocket / Real-time Updates | SSE via Durable Objects (Section 6) |
| CORS OPTIONS Handler | Add explicit OPTIONS handling in a server hook |

---

## 9. Testing Strategy

### E2E Tests (Playwright)
- **Auth refresh flow**: Test that expired access token triggers automatic refresh
- **Remember me**: Test localStorage vs sessionStorage storage
- **Infinite scroll**: Test that scrolling loads more posts
- **Pagination API**: Test page/limit params, has_more flag
- **Real-time (polling fallback)**: Test that new posts appear after mutation
- **Soft delete via API**: Already tested; verify still works with new auth flow
- **Report abuse**: Verify report + auto-hide at threshold

### Unit-style API tests
- `/api/auth/refresh` — valid refresh, expired refresh, reuse detection
- `/api/live/:channel` — SSE connection (may need special handling in tests)
- Pagination edge cases (empty results, last page)

### Build verification
- `pnpm check` — 0 errors, 0 warnings
- `pnpm build` — successful build
- `pnpm test` — all e2e tests pass

---

## 10. Implementation Order

### Phase A: Auth Hardening (JWT + Refresh + Remember Me)
1. Migration: `0014_create_refresh_tokens.sql`
2. Server: Refactor `auth.ts` — add refresh token generation, hashing, verification
3. Server: New `/api/auth/refresh` endpoint (POST + DELETE)
4. Server: Update register/authenticate/recover to return refresh tokens
5. Client: Refactor `auth` store — dual storage, expiry tracking
6. Client: Refactor `ApiClient` — auto-refresh interceptor, proactive refresh
7. UI: Add "remember me" checkbox to PasskeyAuth
8. Update e2e test helper to handle new auth flow

### Phase B: Infinite Scroll + Pagination
1. Create `src/lib/utils/infinite-scroll.ts` action
2. Update `+page.svelte` — infinite scroll, 50 per page
3. Update `CommentSection.svelte` — infinite scroll, 50 per page
4. Update API validation — allow limit up to 50

### Phase C: DB Query Batching
1. Refactor `ratelimit.ts` — batch-friendly functions
2. Refactor `guardPost()` — use db.batch() for ban + rate limit checks
3. Refactor `guardGet()` — use db.batch()
4. Batch read queries in post detail, post list endpoints

### Phase D: Cloudflare Caching
1. Update `cachedJson()` — add Vary header
2. Update `_headers` — explicit cache rules for API and static

### Phase E: Real-time Updates
1. Create `LiveRoom` Durable Object class
2. Update `wrangler.toml` with DO bindings
3. Update `app.d.ts` with DO type
4. Create SSE endpoint `/api/live/[channel]/+server.ts`
5. Create client `live.ts` — EventSource + polling fallback
6. Create `live` Svelte store — merges events into component state
7. Instrument mutation endpoints to broadcast events
8. Wire up components (home page, post detail, comments)

### Phase F: CSS Animations
1. Add animation keyframes to `app.css`
2. Wire animation triggers in VoteButtons, ReactionBar, PostCard, CommentItem
3. Respect `prefers-reduced-motion`

### Phase G: Testing + Polish
1. Update e2e test helpers for new auth flow
2. Write new e2e tests for refresh, infinite scroll, pagination
3. Write e2e tests for real-time polling fallback
4. `pnpm check` — 0 errors, 0 warnings
5. `pnpm build` — clean build
6. `pnpm test` — all tests pass
7. Update `docs/backlog/known_issues.md`
8. Update `agents/progress/02-realtime-checklist.md`

### Phase H: CORS OPTIONS Handler (Backlog)
1. Add SvelteKit server hook to handle OPTIONS preflight requests
