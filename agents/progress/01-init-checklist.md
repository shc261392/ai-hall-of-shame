# AHOS Init — Progress Checklist

> Last updated: 2026-03-04

## Phase 0: Planning
- [x] Stack survey (versions, compatibility)
- [x] Create comprehensive plan (`agents/plans/01-init.md`)
- [x] Database expert review
- [x] UI/UX expert review
- [x] Security expert review
- [x] Revise plan based on reviews
- [x] Create `.copilot-instructions.md`

## Phase 1: Project Scaffold
- [x] Initialize SvelteKit project with Svelte 5
- [x] Configure Volta (node@24) + pnpm via corepack
- [x] Install all dependencies
- [x] Configure adapter-cloudflare
- [x] Configure Tailwind CSS v4
- [x] Configure TypeScript strict mode
- [x] Set up wrangler.toml for D1
- [x] Create .gitignore
- [x] Git init + push to GitHub

## Phase 2: Database
- [x] Write migration 0001_create_users.sql
- [x] Write migration 0002_create_passkey_credentials.sql
- [x] Write migration 0003_create_posts.sql
- [x] Write migration 0004_create_comments.sql
- [x] Write migration 0005_create_votes.sql
- [x] Write migration 0006_create_rate_limits.sql
- [x] Write migration 0007_create_bans.sql
- [x] Write migration 0008_create_challenges.sql

## Phase 3: Auth System
- [x] Server: JWT sign/verify utilities (`src/lib/server/auth.ts`)
- [x] Server: Username generation (`src/lib/server/username.ts`)
- [x] API: GET /api/auth/challenge
- [x] API: POST /api/auth/register
- [x] API: POST /api/auth/authenticate
- [x] API: POST /api/auth/recover
- [x] API: GET /api/auth/me
- [x] API: PATCH /api/auth/me
- [x] Client: Passkey browser helpers (`src/lib/utils/passkey.ts`)
- [x] Client: Auth store (`src/lib/stores/auth.ts`)
- [x] Client: API fetch wrapper (`src/lib/utils/api.ts`)

## Phase 4: Posts & Comments
- [x] API: GET /api/posts (with sorting/pagination)
- [x] API: POST /api/posts
- [x] API: GET /api/posts/[id]
- [x] API: GET /api/posts/[id]/comments
- [x] API: POST /api/posts/[id]/comments

## Phase 5: Voting
- [x] API: POST /api/votes

## Phase 6: Rate Limiting & Bans
- [x] Server: Rate limit middleware (`src/lib/server/ratelimit.ts`)
- [x] Rate limiting on all POST endpoints
- [x] Auto-ban logic
- [x] Clear error responses for agents

## Phase 7: Frontend
- [x] Root layout (`+layout.svelte` + `+layout.ts`)
- [x] Header component
- [x] HeroBanner component
- [x] FilterTabs component
- [x] PostCard component
- [x] PostList component (inline in +page.svelte)
- [x] VoteButtons component
- [x] Home page (`/`)
- [x] Post detail page (`/post/[id]`)
- [x] CommentItem component
- [x] CommentSection component
- [x] Submit page (`/submit`)
- [x] PasskeyAuth component (modal)
- [x] BackupCodeModal component
- [x] Footer component

## Phase 8: Agent-facing Files
- [x] `/static/skill.md` — AI skill file
- [x] `GET /api/heartbeat` — health check

## Phase 9: CI/CD
- [x] `.github/workflows/deploy.yml`
- [x] Type check step
- [x] Build step
- [x] Deploy to Cloudflare Pages

## Phase 10: Polish & Deploy
- [x] Dark theme styling ("Neon Shame" palette)
- [x] Humor copy and tone throughout
- [x] Mobile responsive check
- [x] Final type check passes (0 errors, 0 warnings)
- [x] README.md update (complete rewrite with correct stack, commands, structure)
- [x] Git push to GitHub
- [ ] Verify deployment (pending DNS + first deploy to hallofshame.cc)

## Phase 11: Operational Hardening (Session 2)
- [x] Expanded .gitignore (build artifacts, caches, editor files, OS files)
- [x] `.env.example` created
- [x] `scripts/cf-setup.sh` — one-command Cloudflare infrastructure setup
- [x] `pnpm cf:setup` script added
- [x] `pnpm deploy` script added
- [x] `_headers` CORS configured for hallofshame.cc
- [x] Footer agent instruction text + `/skill.md` link
- [x] `static/skill.md` — comprehensive agent skill file
- [x] GitHub issue templates (bug report, feature request)
- [x] GitHub PR template
- [x] `SECURITY.md` — private vulnerability reporting instructions
- [x] `LICENSE` — GPL v3
- [x] `.vscode/settings.json` — .env excluded from editor/search
- [x] `.github/copilot-instructions.md` — hard ban on reading .env files
- [x] `.copilot-instructions.md` — updated with .env guardrail + _headers explanation

## Phase 12: Reactions, UX & Dev Experience (Session 2 continued)
- [x] `static/favicon.svg` — robot face SVG with neon/flame palette
- [x] `src/app.html` — SVG favicon linked (with ICO fallback)
- [x] `static/.well-known/appspecific/com.chrome.devtools.json` — silence Chrome DevTools 404
- [x] `svelte.config.js` — platformProxy for local Cloudflare D1 bindings in `pnpm dev`
- [x] `wrangler.toml` — `migrations_dir = "migrations"` set
- [x] `pnpm dev:setup` script — runs D1 migrations locally before dev
- [x] `migrations/0009_create_reactions.sql` — reactions table with UNIQUE(post_id, user_id, emoji)
- [x] `src/lib/types/index.ts` — REACTION_EMOJIS, REACTION_LABELS, ReactionCount, Post.reactions
- [x] `src/lib/server/validation.ts` — reactionSchema (Zod enum of 5 emojis)
- [x] `src/routes/api/reactions/+server.ts` — toggle POST (insert/delete), returns all 5 counts
- [x] `src/routes/api/posts/+server.ts` — reactions counts included in post list
- [x] `src/routes/api/posts/[id]/+server.ts` — reactions counts included in post detail
- [x] `src/lib/components/ReactionBar.svelte` — Discord-style emoji picker with optimistic updates
- [x] `src/lib/components/PostCard.svelte` — ReactionBar integrated below post meta
- [x] `src/routes/post/[id]/+page.svelte` — ReactionBar integrated in article
- [x] `src/lib/components/VoteButtons.svelte` — title tooltips as human guide
- [x] `src/lib/components/Footer.svelte` — GitHub icon + link, agent guide link
- [x] `static/skill.md` — em dashes removed, reactions API reference + guidelines added
- [x] Final type check passes (0 errors, 0 warnings)
- [x] Production build passes
