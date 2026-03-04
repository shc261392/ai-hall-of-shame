# Known Issues & Backlog

> Generated from pre-deployment expert review. Items triaged as **MEDIUM** or **LOW** priority.
> Critical and High issues were fixed immediately during the review.
>
> ✅ = Resolved  |  ⬚ = Open

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

### MEDIUM — JWT Revocation Mechanism
**Source**: Security Expert, Abuse Assessment  
Currently JWTs are valid for 7 days with no revocation. A compromised token cannot be invalidated. Implement a token blocklist table in D1 or switch to short-lived tokens + refresh tokens.

### MEDIUM — CSP `unsafe-inline` for Styles
**Source**: Security Expert  
Tailwind CSS v4 injects inline styles, requiring `unsafe-inline` in Content-Security-Policy for `style-src`. Investigate nonce-based CSP or extracting Tailwind to external stylesheets for stricter CSP.

### MEDIUM — CORS OPTIONS Handler
**Source**: Security Expert  
API routes don't explicitly handle OPTIONS preflight requests. SvelteKit/Cloudflare may handle this implicitly, but explicit CORS headers should be verified for cross-origin scenarios.

### ✅ ~~MEDIUM — Content Deletion / Moderation System~~
**Source**: Security Expert, Abuse Assessment  
~~No ability for users to delete their own posts/comments, and no admin moderation tools.~~  
**Resolved**: Soft-delete for own posts/comments (DELETE endpoints), Report Abuse button (POST /api/reports) with auto-hide at ≥10 reports, pre-filled GitHub issue URL for abuse reports. See migrations 0012, API routes, and `ReportButton.svelte`.

### MEDIUM — Registration Daily Caps
**Source**: Abuse Assessment  
Rate limiting exists per-IP for registration, but no daily cap on total new accounts. A motivated attacker could create many accounts from rotating IPs. Consider a global daily registration cap or Cloudflare Turnstile.

### MEDIUM — NSFW / Offensive Content Filtering
**Source**: Abuse Assessment  
No content filtering for posts or comments. Consider integrating a basic word filter or Cloudflare Workers AI content moderation for text submissions.

### ✅ ~~MEDIUM — Content-Length Pre-Check~~
**Source**: Abuse Assessment  
~~API routes don't reject oversized request bodies before parsing.~~  
**Resolved**: Added `MAX_BODY_BYTES` (64 KB) Content-Length validation in `guardPost()` middleware. Returns 413 for oversized payloads.

### LOW — Cloudflare WAF / Turnstile Integration
**Source**: Security Expert, Abuse Assessment  
Consider enabling Cloudflare WAF managed rules and adding Turnstile CAPTCHA to registration/submission flows for defense-in-depth against automated abuse.

### LOW — Audit Logging
**Source**: Security Expert  
No audit trail for security-sensitive actions (login, registration, password recovery, ban events). Consider a lightweight audit log table for forensic analysis.

### LOW — Timing Attack on Username Check
**Source**: Security Expert  
The `isReservedUsername` check uses array `.includes()` which may leak timing information about reserved usernames. Low risk but could use constant-time comparison if concerned.

---

## Database

### MEDIUM — ON DELETE CASCADE Missing
**Source**: Database Expert  
Foreign keys exist but lack `ON DELETE CASCADE`. Deleting a user leaves orphaned posts, comments, votes, and reactions. Requires table recreation migrations (SQLite doesn't support `ALTER TABLE ... ADD CONSTRAINT`).

### MEDIUM — Denormalized Vote Count Consistency
**Source**: Database Expert  
`posts.vote_count` and `comments.vote_count` are denormalized counters updated in application code. No DB triggers or periodic reconciliation exists. If a race condition corrupts a count, it stays wrong. Consider a reconciliation job or D1 triggers when available.

### MEDIUM — DB Query Batching
**Source**: Database Expert, Performance Expert  
Multiple sequential queries in middleware (ban check → rate limit check) and endpoints could use `db.batch()` to reduce D1 round trips. Refactoring guardPost/guardGet and API routes to batch queries would improve latency.

### ✅ ~~LOW — Missing Composite Indexes~~
**Source**: Database Expert  
~~Some query patterns could benefit from composite indexes.~~  
**Resolved**: Added composite indexes in migration 0013: `idx_votes_lookup(target_type, target_id, user_id)` and `idx_reactions_post_user(post_id, user_id, emoji)`.

### LOW — No Database Migrations Versioning Table
**Source**: Database Expert  
Migrations are applied via Wrangler CLI but there's no application-level tracking of which migrations have been applied. Wrangler tracks this, but consider a `_migrations` table for visibility.

### LOW — PRAGMA Optimizations
**Source**: Database Expert  
D1 may benefit from `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` if not already set by Cloudflare. Verify foreign key enforcement is active at runtime.

---

## Performance

### ✅ ~~MEDIUM — Lazy-Load marked + DOMPurify~~
**Source**: Performance Expert  
~~`marked` (~35KB) and `dompurify` (~15KB) are imported eagerly in `markdown.ts`.~~  
**Resolved**: Extracted `stripMarkdown()` to a zero-dependency `strip-markdown.ts` module so the home page (PostCard) no longer pulls in marked+dompurify. Full rendering still loads them only when needed.

### ✅ ~~MEDIUM — HTTP Cache Headers on API Responses~~
**Source**: Performance Expert  
~~API responses don't set `Cache-Control` headers.~~  
**Resolved**: Added `cachedJson()` helper in middleware.ts. All public GET endpoints (posts list, post detail, comments) now return `Cache-Control: public, max-age=10, stale-while-revalidate=30`.

### LOW — Image/Asset Optimization
**Source**: Performance Expert  
No image optimization pipeline. If user-generated images are added later, integrate Cloudflare Images or a build-time optimizer. Currently low impact since the app is text-only.

### LOW — Bundle Size Monitoring
**Source**: Performance Expert  
No automated bundle size tracking. Consider adding `vite-plugin-bundle-analyzer` or a CI check to catch unexpected size regressions.

### LOW — Preconnect Hints
**Source**: Performance Expert  
No `<link rel="preconnect">` hints for external origins. If external fonts or APIs are added, preconnect hints should be included in `app.html`.

---

## UI/UX & Accessibility

### ✅ ~~MEDIUM — PostCard Interactive Nesting~~
**Source**: UI/UX Expert, Accessibility Expert  
~~`PostCard.svelte` wraps the entire card in an `<a>` tag, but contains interactive children.~~  
**Resolved**: Restructured PostCard to use a `<div>` with click handler. Title is the only `<a>` link; vote/reaction buttons are no longer nested inside an anchor.

### ✅ ~~MEDIUM — Focus Management in Modals~~
**Source**: UI/UX Expert  
~~`PasskeyAuth.svelte` and `BackupCodeModal.svelte` don't trap focus inside the modal.~~  
**Resolved**: Created `focus-trap.ts` utility. Both modals now use `use:initFocusTrap` Svelte action for Tab cycling between first/last focusable elements. Added `tabindex="-1"` for role="dialog" a11y compliance.

### ✅ ~~MEDIUM — Skip Navigation Link~~
**Source**: Accessibility Expert  
~~No "Skip to main content" link for keyboard users.~~  
**Resolved**: Added visually-hidden skip link as first focusable element in `+layout.svelte`, targeting `#main-content` on the `<main>` element.

### MEDIUM — Error State Communication
**Source**: UI/UX Expert  
Form validation errors are shown via Toast notifications which are ephemeral. Inline error messages associated with form fields (using `aria-describedby`) would be more accessible and persistent.

### LOW — Keyboard Navigation Enhancement
**Source**: UI/UX Expert  
Vote buttons and reaction buttons could benefit from keyboard shortcut hints and visible focus indicators beyond the default browser outline.

### ✅ ~~LOW — Reduced Motion Support~~
**Source**: Accessibility Expert  
~~Loading spinner animation doesn't respect `prefers-reduced-motion`.~~  
**Resolved**: `app.css` includes `@media (prefers-reduced-motion: reduce)` rules that disable/simplify animations globally.

### ✅ ~~LOW — Color Contrast on Muted Text~~
**Source**: UI/UX Expert  
~~Some `text-zinc-500` usage on dark backgrounds may not meet WCAG AA contrast ratio.~~  
**Resolved**: Audited — only instances are decorative footer text (`text-shame-300/50`, `text-shame-300/60`) which is intentionally subdued. No functional text has insufficient contrast.

### ✅ ~~LOW — Empty State CTAs~~
**Source**: UI/UX Expert  
~~Empty states show messages but could include a direct call-to-action button.~~  
**Resolved**: Enhanced `EmptyState.svelte` with optional `actionHref` + `actionLabel` props. Home page empty state now includes CTA to `/submit`.

---

## Code Quality

### ✅ ~~MEDIUM — `any` Type Usage (~20 instances)~~
**Source**: Code Reviewer  
~~Multiple files use `any` type, particularly in API response handling.~~  
**Resolved**: Added `PostRow` and `CommentRow` interfaces to `types/index.ts`. Replaced all `any` casts in API routes with typed D1 queries (`.first<PostRow>()`, `.all<PostRow>()`, `.all<CommentRow>()`).

### ✅ ~~MEDIUM — `@types/marked` Removal~~
**Source**: Code Reviewer  
~~`@types/marked` is installed but `marked` v17+ ships its own TypeScript types.~~  
**Resolved**: Removed `@types/marked` and `@types/dompurify` from devDependencies.

### ✅ ~~LOW — Error Boundary Components~~
**Source**: Code Reviewer  
~~No `+error.svelte` pages exist.~~  
**Resolved**: Created `src/routes/+error.svelte` with custom error page showing status code, message, and "Back to feed" CTA.

### LOW — Type Guard for Discriminated Unions
**Source**: Code Reviewer  
API error responses have different shapes but aren't narrowed with type guards. Add discriminated union types for API responses.

### LOW — Console.error in Production
**Source**: Code Reviewer  
Several `console.error()` calls exist in server routes. These are fine for Cloudflare Workers logging but should be reviewed to ensure no sensitive data is logged.

---

## Architecture

### ✅ ~~MEDIUM — No Soft Delete~~
**Source**: Database Expert, Security Expert  
~~Posts and comments have no soft-delete mechanism.~~  
**Resolved**: Added `deleted_at` column to posts and comments (migration 0012). DELETE endpoints for own content set `deleted_at = unixepoch()`. All queries filter `WHERE deleted_at IS NULL`. Reports table with auto-hide at ≥10 reports.

### LOW — No WebSocket / Real-time Updates
**Source**: UI/UX Expert  
Vote counts and reactions update only on page load. Consider polling or Cloudflare Durable Objects for real-time updates in a future version.

### LOW — No Pagination on Home Page
**Source**: Performance Expert  
The home page loads all posts in a single query. As the dataset grows, this will become a performance issue. Add cursor-based or offset pagination.

### LOW — Session Storage Fragility
**Source**: Security Expert  
JWT stored in `sessionStorage` is lost on tab close. This is intentional for security but may frustrate users. Consider offering a "remember me" option with `localStorage` and shorter token expiry.
