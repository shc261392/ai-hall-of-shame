# Known Issues & Backlog

> Maintained from expert reviews (Security, Code Review, Database, Performance, UI/UX).
> Critical, High, and Blocker issues are fixed immediately.
> Medium and Low items are tracked here for future work.
>
> Last updated after Phase 2H final review session.

---

## Table of Contents

- [Security](#security)
- [Database](#database)
- [Performance](#performance)
- [UI/UX & Accessibility](#uiux--accessibility)
- [Code Quality](#code-quality)
- [Architecture](#architecture)

---

## Security

### MEDIUM — CSP `unsafe-inline` for Scripts and Styles
**Source**: Security Expert (C1, M6)
SvelteKit SPA injects inline scripts, requiring `unsafe-inline` in `script-src`. Tailwind CSS v4 injects inline styles requiring `unsafe-inline` in `style-src`. Hash-based CSP is complex with SvelteKit's runtime. Investigate nonce-based CSP or adapter-level CSP support when available.

### MEDIUM — Refresh Token Family Tracking
**Source**: Security Expert (M1)
If a refresh token is stolen and used, the legitimate user's next refresh attempt will fail (token already consumed), but the server doesn't detect the theft and revoke all tokens in the family. Implement refresh token rotation with family tracking so stolen chains are detected and all related tokens invalidated.

### MEDIUM — Registration Daily Caps
**Source**: Abuse Assessment
Rate limiting exists per-IP for registration, but no daily cap on total new accounts. A motivated attacker could create many accounts from rotating IPs. Consider a global daily registration cap or Cloudflare Turnstile.

### MEDIUM — NSFW / Offensive Content Filtering
**Source**: Abuse Assessment
No content filtering for posts or comments. Consider integrating a basic word filter or Cloudflare Workers AI content moderation for text submissions.

### LOW — Cloudflare WAF / Turnstile Integration
**Source**: Security Expert, Abuse Assessment
Consider enabling Cloudflare WAF managed rules and adding Turnstile CAPTCHA to registration/submission flows for defense-in-depth against automated abuse.

### LOW — Audit Logging
**Source**: Security Expert (L3)
No audit trail for security-sensitive actions (login, registration, recovery, ban events). Consider a lightweight audit log table for forensic analysis.

### LOW — X-Forwarded-For Spoofable
**Source**: Security Expert (L4)
`getClientIp()` uses `X-Forwarded-For` which can be spoofed. On Cloudflare, `CF-Connecting-IP` is the trusted source and is preferred. Risk is negligible when deployed behind Cloudflare, but worth noting for non-CF environments.

### LOW — Tokens in Web Storage
**Source**: Security Expert (L5)
Access and refresh tokens are stored in `sessionStorage`. This is an architectural trade-off for the SPA model (no cookies, no SSR). XSS could exfiltrate tokens, but CSP and DOMPurify mitigate this. Short-lived access tokens (15 min) limit exposure.

### LOW — Test Endpoints in Production Bundle
**Source**: Code Reviewer
`/api/test/*` routes are guarded by `dev` import from `$app/environment` which is compile-time dead code eliminated in production builds. The route files still exist in source but handlers are unreachable.

---

## Database

### MEDIUM — ON DELETE CASCADE Missing
**Source**: Database Expert
Foreign keys exist but lack `ON DELETE CASCADE` (except reactions and reports). Deleting a user leaves orphaned posts, comments, votes. Requires table recreation (SQLite limitation).

### MEDIUM — Denormalized Vote Count Consistency
**Source**: Database Expert, Code Reviewer
`posts.upvotes/downvotes` and `comments.upvotes/downvotes` are denormalized counters. No DB triggers or periodic reconciliation exists. Concurrent vote requests can desync counters if the UNIQUE constraint on votes is violated during a race. Consider a reconciliation job.

### MEDIUM — DB Query Batching
**Source**: Database Expert, Performance Expert, Code Reviewer
Multiple sequential queries in middleware (ban check → rate limit check) and endpoints (single-post GET makes 3-4 sequential queries) could use `db.batch()` to reduce D1 round trips.

### LOW — PRAGMA Optimizations
**Source**: Database Expert
D1 may benefit from `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` if not already set by Cloudflare. Verify foreign key enforcement is active at runtime.

---

## Performance

### LOW — Image/Asset Optimization
**Source**: Performance Expert
No image optimization pipeline. If user-generated images are added later, integrate Cloudflare Images. Currently low impact since the app is text-only.

### LOW — Bundle Size Monitoring
**Source**: Performance Expert
No automated bundle size tracking. Consider adding a CI check to catch unexpected size regressions.

---

## UI/UX & Accessibility

### MEDIUM — Error State Communication
**Source**: UI/UX Expert
Form validation errors are shown via Toast notifications which are ephemeral. Inline error messages associated with form fields (using `aria-describedby`) would be more accessible and persistent.

### LOW — Keyboard Navigation Enhancement
**Source**: UI/UX Expert
Vote buttons and reaction buttons could benefit from keyboard shortcut hints and visible focus indicators beyond the default browser outline.

---

## Code Quality

### MEDIUM — Unused Functions/Imports in Components
**Source**: Code Reviewer
Several components have unused imports or functions that may indicate incomplete features or dead code: `Header.svelte`, `PasskeyAuth.svelte`, `CommentSection.svelte`. Audit and clean up.

### LOW — `any` Type in Catch Blocks
**Source**: Code Reviewer
Error catch blocks use untyped `catch (e)`. Consider using `unknown` and properly narrowing error types.

### LOW — Stores Use `writable` Instead of Svelte 5 Runes
**Source**: Code Reviewer
Auth and toast stores use `writable()` from `svelte/store` instead of Svelte 5's `$state` runes. This works but is legacy Svelte 4 style. Migrate to rune-based stores when convenient.

### LOW — `generateUniqueUsername` Sequential Queries
**Source**: Code Reviewer
Username generation makes up to 10 sequential DB queries to find an available username. Consider a more efficient approach (uuid suffix, batch check).

### LOW — Console.error in Production
**Source**: Code Reviewer
Several `console.error()` calls exist in server routes. Workers Logs (observability) is now enabled at 100% sampling in `wrangler.toml`, so these logs are captured in the Cloudflare dashboard. Review to ensure no sensitive data is logged.

### LOW — Report Count Increment Non-Atomic
**Source**: Code Reviewer
The report count check and increment are not atomic — two concurrent reports could both pass the threshold check before either increments. Low risk given expected traffic.

### LOW — Stale JWT Username After Profile Update
**Source**: Code Reviewer
When a user updates their username, other open tabs still have the old username in their JWT until the token is refreshed. The profile is fetched fresh from `/api/auth/me`, so display is correct, but the JWT payload is stale.

---

## Architecture

### LOW — Real-time SSE Graceful Degradation
**Source**: Code Reviewer
SSE connections retry with exponential backoff and give up after 5 attempts. There is no user-visible indicator that real-time updates are unavailable. Consider a subtle UI hint.

### LOW — No Pagination on Home Page
**Source**: Performance Expert  
The home page loads all posts in a single query. As the dataset grows, this will become a performance issue. Add cursor-based or offset pagination.

### LOW — Session Storage Fragility
**Source**: Security Expert  
JWT stored in `sessionStorage` is lost on tab close. This is intentional for security but may frustrate users. Consider offering a "remember me" option with `localStorage` and shorter token expiry.
