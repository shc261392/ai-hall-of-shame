# AHOS Phase 2 — Progress Checklist

> Last updated: 2026-03-04

## Phase A: Auth Hardening (JWT + Refresh + Remember Me)
- [x] Migration: `0014_create_refresh_tokens.sql`
- [x] Server: Refactor `auth.ts` — refresh token generation, hashing, verification
- [x] Server: New `/api/auth/refresh` endpoint (POST + DELETE)
- [x] Server: Update register/authenticate/recover to return refresh tokens
- [x] Client: Refactor `auth` store — dual storage, expiry tracking
- [x] Client: Refactor `ApiClient` — auto-refresh interceptor
- [x] UI: Add "remember me" checkbox to PasskeyAuth
- [x] Update e2e test helper for new auth flow

## Phase B: Infinite Scroll + Pagination
- [x] Create `src/lib/utils/infinite-scroll.ts` action
- [x] Update `+page.svelte` — infinite scroll, 50 per page
- [x] Update `CommentSection.svelte` — infinite scroll, 50 per page
- [x] Update API validation — allow limit up to 50

## Phase C: DB Query Batching
- [x] Refactor `ratelimit.ts` — batch-friendly functions
- [x] Refactor `guardPost()` — use db.batch()
- [x] Refactor `guardGet()` — use db.batch()
- [x] Batch read queries in post detail endpoint

## Phase D: Cloudflare Caching
- [x] Update `cachedJson()` — add Vary header
- [x] Update `_headers` — cache rules

## Phase E: Real-time Updates
- [x] Create `LiveRoom` Durable Object class
- [x] Update `wrangler.toml` with DO bindings
- [x] Update `app.d.ts` with DO type
- [x] Create SSE endpoint `/api/live/[channel]/+server.ts`
- [x] Create client `live.ts` — EventSource + polling fallback
- [x] Create `live` Svelte store
- [x] Instrument mutation endpoints to broadcast
- [x] Wire up components (home page, post detail, comments)

## Phase F: CSS Animations
- [x] Add animation keyframes to `app.css`
- [x] Wire animation triggers in components
- [x] Respect `prefers-reduced-motion`

## Phase G: Testing + Polish
- [x] Update e2e test helpers for new auth flow
- [x] Write e2e tests for refresh, infinite scroll, pagination
- [x] Write e2e tests for real-time polling fallback
- [x] `pnpm check` — 0 errors, 0 warnings
- [x] `pnpm build` — clean build
- [x] `pnpm test` — all tests pass (77/77)
- [x] Update `docs/backlog/known_issues.md`

## Phase H: CORS OPTIONS Handler
- [x] Add SvelteKit server hook for OPTIONS preflight
