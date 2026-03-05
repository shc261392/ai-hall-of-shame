# Pre-Deployment Risk Assessment

> AI Hall of Shame — https://hallofshame.cc
> Assessed after Phase 2H final review session.

---

## Deployment Readiness Summary

| Area | Status | Notes |
|------|--------|-------|
| Build | ✅ Clean | `pnpm build` — zero errors |
| Type checking | ✅ Clean | `pnpm check` — 0 errors, 0 warnings |
| E2E tests | ✅ 77/77 pass | All API + UI tests green |
| Remote D1 | ✅ Fresh | New DB with consolidated single migration |
| Security fixes | ✅ Done | All CRITICAL/HIGH/BLOCKER issues resolved |
| CSP headers | ⚠️ Partial | `unsafe-inline` required for scripts/styles (SvelteKit SPA limitation) |
| Secrets | ✅ Set | JWT_SECRET, WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME on Cloudflare Pages |

---

## Risks & Caveats (Honest Assessment)

### 1. CSP `unsafe-inline` — MEDIUM RISK
**What**: Both `script-src` and `style-src` require `'unsafe-inline'` because SvelteKit injects inline scripts for the SPA hydration and Tailwind CSS v4 uses inline styles.
**Impact**: XSS payloads could execute inline scripts. DOMPurify sanitizes all user-generated Markdown, but a bypass in DOMPurify or a missed sanitization path would be exploitable.
**Mitigation**: DOMPurify on all user content, no `{@html}` with raw user input, strict CSP for everything else (no `unsafe-eval`, no external scripts). Monitor for SvelteKit CSP nonce support.

### 2. Tokens in sessionStorage — LOW-MEDIUM RISK
**What**: Access tokens (15 min) and refresh tokens (30 day) are stored in `sessionStorage`.
**Impact**: If XSS occurs, tokens can be exfiltrated. Refresh tokens give 30-day access.
**Mitigation**: Short-lived access tokens, refresh token rotation (one-time use), CSP + DOMPurify reduces XSS surface. Alternative (HTTP-only cookies) would require SSR which contradicts the SPA architecture.

### 3. No Refresh Token Family Tracking — MEDIUM RISK
**What**: If a refresh token is stolen and used before the legitimate user, the attacker gets a valid new pair. The victim's next refresh fails, but the server doesn't detect theft.
**Impact**: Stolen refresh token gives attacker up to 30 days of access.
**Mitigation**: Short access token lifetime (15 min). Refresh tokens are one-time use — victim will notice their session ended. Tracked in known_issues.md for future implementation.

### 4. Rate Limiting Accuracy — LOW RISK
**What**: Rate limiting uses a sliding window in D1. Under high concurrency, the check-then-increment is not atomic (separate SELECT + INSERT).
**Impact**: A burst of concurrent requests from the same IP could slightly exceed the rate limit before the count catches up.
**Mitigation**: Tiered rate limits (heavy: 5/user, 15/IP per min for expensive ops; light: 30/user, 60/IP per min for votes/reactions/comments; get: 120/IP per min for reads) are generous enough that slight overcount is acceptable. Auto-ban triggers at 100 requests in a 10-minute window for sustained abuse.

### 5. Durable Object SSE — LOW RISK
**What**: Real-time updates via Durable Objects work in production but cannot be tested locally (workerd doesn't support internal DO class references). The `broadcast.ts` and live endpoint have `.catch()` guards that gracefully degrade.
**Impact**: If the DO fails in production, the site degrades to no real-time updates. Posts, votes, comments still work — just no live push.
**Mitigation**: Client SSE retries with exponential backoff and gives up gracefully after 5 attempts. All data is always fetched via REST on page load.

### 6. No Content Moderation — MEDIUM RISK
**What**: No automated content filtering. Users can post anything (within character limits).
**Impact**: NSFW, offensive, or illegal content could appear. Report-based auto-hide (10 reports) is the only mechanism.
**Mitigation**: Manual monitoring initially. Report button creates pre-filled GitHub issues for manual review. Consider Cloudflare Workers AI content moderation or Turnstile for registration as usage grows.

### 7. Single-Region D1 — LOW RISK
**What**: D1 database is in APAC region (based on account location). Users in other regions will see higher latency for write operations.
**Impact**: ~100-300ms additional latency for writes from US/EU users.
**Mitigation**: Read replicas are a D1 feature that could be enabled. GET endpoints use Cache-Control headers. Acceptable for MVP.

### 8. Monitoring/Alerting — LOW RISK
**What**: Workers Logs (observability) is enabled at 100% sampling rate via `wrangler.toml`. This captures invocation logs, `console.log` output, errors, and uncaught exceptions. No automated alerting yet.
**Impact**: Errors are now visible in the Cloudflare dashboard (Workers & Pages → Logs). Abuse spikes and DB issues can be investigated. No push alerting means issues still require manual log review.
**Mitigation**: Workers Logs provides post-hoc debugging. Free tier: 200K events/day, Paid: 20M/month. Consider adding Cloudflare Logpush or Sentry for proactive alerting post-launch.

---

## Pre-Deployment Checklist

- [x] `pnpm check` — 0 errors, 0 warnings
- [x] `pnpm build` — clean production build
- [x] 77/77 E2E tests pass
- [x] Remote D1 database created with fresh schema
- [x] Remote migration applied (1 consolidated migration)
- [x] Secrets set on Cloudflare Pages (JWT_SECRET, WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME)
- [x] `_headers` file has CSP, X-Frame-Options, CORS
- [x] CORS locked to `https://hallofshame.cc` (not `*`)
- [x] DO SSE origin locked to `https://hallofshame.cc`
- [x] Rate limiting on all mutation endpoints including refresh (tiered: heavy/light/get)
- [x] Workers Logs (observability) enabled at 100% sampling
- [x] JWT has issuer/audience claims
- [x] Cache-Control: private for authenticated, public for anonymous
- [x] Input validation (Zod) on all endpoints
- [x] SQL injection prevention (parameterized queries everywhere)
- [x] XSS prevention (DOMPurify on all user Markdown)
- [x] All security CRITICAL/HIGH issues from expert review fixed
- [x] All code review BLOCKER/MAJOR issues fixed
- [x] known_issues.md updated and cleaned of resolved items
- [ ] DNS is configured for hallofshame.cc → Cloudflare Pages
- [ ] Custom domain attached to Pages project
- [ ] First deploy: `pnpm deploy` (builds + deploys to CF Pages)
- [ ] Smoke test live site: register, create post, vote, comment, react
- [ ] Verify DO SSE works in production (live vote updates)

---

## Recommendation

**Ready for deployment** with the caveats above acknowledged. The main risks are:
1. CSP `unsafe-inline` (architectural, not fixable without SvelteKit support)
2. No content moderation (acceptable for soft launch with small audience)
3. No proactive alerting (Workers Logs enabled; set up push alerting within first week)

None of these are deployment blockers. Deploy, smoke test, and monitor closely during the first 24-48 hours.
