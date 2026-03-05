# Deployment Architecture: Pages + DO Worker vs Pure Worker + DO

> Decision report for AI Hall of Shame (AHOS)
> Generated: 2026-03-06

## Context

AHOS is a SvelteKit app deployed to Cloudflare. It uses D1 for persistence and an optional Durable Object (`LiveRoom`) for real-time SSE broadcasting. The project is non-monetized — **free tier limits are the primary constraint.**

After fixing wrangler validation errors, the project was split into two deployable units (Pages + separate DO Worker) because Cloudflare Pages cannot host Durable Objects inline. This report evaluates whether migrating to a pure Worker with Workers Static Assets would be better.

---

## Options

| | **A: Pages + DO Worker** (current) | **B: Pure Worker + DO** | **C: Pages only (drop DO)** |
|---|---|---|---|
| Deployable units | 2 (Pages + Worker) | 1 (Worker) | 1 (Pages) |
| Config files | 2 (`wrangler.toml` + `wrangler.worker.toml`) | 1 (`wrangler.toml`) | 1 (`wrangler.toml`) |
| DO support | Via service binding to external Worker | Inline — same Worker | None |
| Real-time SSE | Yes | Yes | No (graceful degradation already built) |
| Static assets | Free & unlimited | Free & unlimited | Free & unlimited |
| SvelteKit adapter | `adapter-cloudflare` (unchanged) | `adapter-cloudflare` (unchanged) | `adapter-cloudflare` (unchanged) |

---

## 1. Free Tier Quota Analysis (Highest Priority)

### Account-wide free tier limits (reset daily at 00:00 UTC)

| Resource | Free Limit | Notes |
|---|---|---|
| Worker/Pages Function requests | **100,000/day** | Shared across ALL Workers and Pages Functions in the account |
| CPU time | **10 ms per invocation** | Hard cap per invocation, not cumulative |
| Durable Object requests | **100,000/day** | Separate quota from Worker requests |
| DO duration | **13,000 GB-s/day** | Wall-clock time while active and not hibernation-eligible |
| D1 rows read | **5,000,000/day** | Shared across all D1 databases |
| D1 rows written | **100,000/day** | Shared across all D1 databases |
| D1 storage | **5 GB total** | |
| Static asset requests | **Unlimited, free** | Both Pages and Workers Static Assets |
| Workers Logs | **200,000/day** | 3-day retention |

### Request quota impact by option

#### Option A: Pages + DO Worker

1. User visits page → **Pages Function invocation** → counts as 1 Worker request
2. Pages Function calls DO Worker (via service binding) → **no additional Worker request charge** (service bindings are free on Standard pricing, which includes the free plan)
3. DO processes the call → counts as 1 **DO request** (separate 100K/day pool)

**Total per page load with real-time: 1 Worker request + 1 DO request**

#### Option B: Pure Worker + DO

1. User visits page → **Worker invocation** → counts as 1 Worker request
2. Worker calls DO (directly, same Worker) → counts as 1 **DO request** (separate pool)

**Total per page load with real-time: 1 Worker request + 1 DO request**

#### Option C: Pages without DO

1. User visits page → **Pages Function invocation** → counts as 1 Worker request

**Total per page load: 1 Worker request only**

### Verdict: No pricing difference between A and B

Both Options A and B consume identical quota:
- **Same 100K/day Worker request pool** (Pages Functions are billed as Workers)
- **Same 100K/day DO request pool** (DO quota is always separate)
- **Same free static asset serving** (both Pages and Workers Static Assets are free and unlimited)
- **Service binding calls do not incur additional request charges** (confirmed in Cloudflare pricing docs — exception is only for deprecated Bundled/Unbound plans)

Option C saves the most quota by eliminating DO requests entirely.

---

## 2. Complexity & Maintainability

| Factor | A: Pages + DO Worker | B: Pure Worker + DO | C: Pages only |
|---|---|---|---|
| Config files to maintain | 2 | 1 | 1 |
| Deploy commands | 2 (ordered: Worker first, then Pages) | 1 (`wrangler deploy`) | 1 (`wrangler pages deploy`) |
| Deploy ordering risk | Worker must deploy before Pages; failure = broken real-time | None | None |
| Local dev setup | Must run 2 wrangler instances or use `-c` multi-config | Single `wrangler dev` | Single `wrangler pages dev` |
| DO access pattern | Service binding (indirect, cross-Worker) | Direct binding (same Worker) | N/A |
| Type safety | `LIVE_ROOM` must be optional (may be unavailable) | `LIVE_ROOM` can still be optional for safety, but is always present | `LIVE_ROOM` removed |
| New developer onboarding | Must understand split architecture | Standard single-Worker model | Simplest possible |

---

## 3. Feature Availability (Compatibility Matrix)

From Cloudflare's official compatibility matrix:

| Feature | Workers | Pages |
|---|---|---|
| Durable Objects | ✅ Native | 🟡 Workaround (separate Worker) |
| Cron Triggers | ✅ | ❌ |
| Workers Logs | ✅ | ❌ |
| Logpush | ✅ | ❌ |
| Tail Workers | ✅ | ❌ |
| Gradual Deployments | ✅ | ❌ |
| Cloudflare Vite Plugin | ✅ | ❌ |
| Source Maps | ✅ | ❌ |
| Preview URLs | ✅ | ✅ |
| `_headers` / `_redirects` | ✅ | ✅ |
| Custom domains (outside CF zones) | ❌ | ✅ |
| Early Hints | ❌ | ✅ |

Workers has a strictly broader feature set. Pages has two niche advantages (non-CF-zone domains and Early Hints) that are unlikely to matter for this project.

---

## 4. Durable Object Dependency Assessment

The `LiveRoom` DO is **purely additive** — all CRUD operations work without it:

- 6 mutation endpoints call `broadcast()` AFTER database writes succeed. If DO is unavailable, the write still completes.
- `broadcast()` checks `platform?.env.LIVE_ROOM` and returns early if undefined. Errors are silently caught: `.catch(() => {})`.
- The SSE endpoint (`/api/live/[channel]`) returns 404 if DO is unavailable.
- Client-side `LiveConnection` retries 5 times then stops. Pages function without real-time.
- `LIVE_ROOM` is typed as `DurableObjectNamespace | undefined` in `app.d.ts`.

**Conclusion: The app is fully functional without DO. Real-time is a nice-to-have enhancement.**

---

## 5. Migration Effort

### A → B (current Pages + DO Worker → pure Worker)

The **same SvelteKit adapter** (`@sveltejs/adapter-cloudflare`) supports both Pages and Workers deployment. Migration is configuration-only:

| Step | Change |
|---|---|
| `wrangler.toml` | Replace `pages_build_output_dir` with `main`, `assets.directory`, `assets.binding`; add DO binding inline (no `script_name`); add `[[migrations]]` and `[observability]` |
| `wrangler.worker.toml` | Delete |
| `workers/live-room.ts` | Delete |
| `package.json` scripts | Replace `wrangler pages deploy` with `wrangler deploy`; remove `dev:worker` and `deploy:worker` |
| `scripts/cf-setup.sh` | Remove DO Worker deployment step |
| `svelte.config.js` | No change (adapter-cloudflare works for both) |
| Application code | No change |

Estimated wrangler.toml for Option B:
```toml
name = "ahos"
compatibility_date = "2026-03-01"
main = ".svelte-kit/cloudflare/_worker.js"

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[observability]
enabled = true
head_sampling_rate = 1

[[d1_databases]]
binding = "DB"
database_name = "ahos-db"
database_id = "e4fb14b9-11b9-4e9c-8ad5-6a08d94b3191"
migrations_dir = "migrations"

[[durable_objects.bindings]]
name = "LIVE_ROOM"
class_name = "LiveRoom"

[[migrations]]
tag = "v1"
new_classes = ["LiveRoom"]
```

### A → C (current Pages + DO Worker → Pages only)

| Step | Change |
|---|---|
| `wrangler.toml` | Remove `[[durable_objects.bindings]]` |
| `wrangler.worker.toml` | Delete |
| `workers/live-room.ts` | Delete |
| `src/lib/server/live-room.ts` | Delete |
| `src/lib/server/broadcast.ts` | Delete or no-op |
| `src/routes/api/live/[channel]/+server.ts` | Delete |
| `src/lib/utils/live.ts` | Delete |
| `app.d.ts` | Remove `LIVE_ROOM` type |
| `package.json` scripts | Remove `dev:worker` and `deploy:worker` |

---

## 6. Risk Factors

| Risk | A: Pages + DO Worker | B: Pure Worker | C: Pages only |
|---|---|---|---|
| Cloudflare deprecates Pages | Medium — CF is actively steering toward Workers; official migration guide exists | None — Workers is the long-term platform | Medium |
| Free tier exceeded | Low — same consumption as B | Low — same consumption as A | Lowest — no DO usage |
| Deploy failure breaks real-time | High — Worker must deploy before Pages | Low — atomic single deploy | None |
| Service binding latency | Negligible (same thread, zero overhead per CF docs) | N/A | N/A |

**Notable: Cloudflare's official migration guide and compatibility matrix signal that Workers is the strategic long-term platform.** Pages is not deprecated but has stopped gaining parity with Workers for new features (Vite plugin, Logpush, Gradual Deployments, etc.).

---

## 7. Recommendation

### Recommended: Option B — Pure Worker + DO

**Rationale:**

1. **Free tier impact: identical.** There is zero pricing or quota advantage to Pages over Workers. Static assets are free on both. Service binding calls don't save requests. The 100K/day Worker and 100K/day DO quotas apply equally to both options.

2. **Simpler operations.** One config file, one deploy command, no deployment ordering concerns. This is the biggest practical win.

3. **Better feature access.** Workers Logs, Logpush, Gradual Deployments, Cron Triggers, and the Cloudflare Vite Plugin are all Workers-only. Even if not needed today, they're available without re-architecture.

4. **Platform alignment.** Cloudflare is investing in Workers as the unified compute platform. The official adapter-cloudflare description says "builds for Cloudflare Workers Static Assets and Cloudflare Pages" — Workers is listed first and actively promoted in migration guides.

5. **Minimal migration.** The same `@sveltejs/adapter-cloudflare` works for both. Migration is purely configuration — no application code changes needed. It's actually a simplification (delete files, modify one config).

6. **DO stays optional.** Keep the 3-layer graceful degradation. Real-time is additive. If free-tier DO quota becomes a concern later, removing DO from a single Worker is simpler than decommissioning a separate Worker.

### If real-time is not worth the DO complexity at all

Consider **Option C** (drop DO entirely) as an alternative. It eliminates 100% of DO complexity and quota consumption while the app remains fully functional. Real-time SSE can always be re-added later as a pure Worker or via a different mechanism (e.g., polling).

### Not recommended: Option A (current setup)

The Pages + separate DO Worker approach has the same cost as Option B with strictly more operational complexity. There is no scenario where Option A is preferable to Option B.
