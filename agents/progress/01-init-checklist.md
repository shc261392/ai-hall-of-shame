# AHOS Init — Progress Checklist

> Last updated: 2026-03-03

## Phase 0: Planning
- [x] Stack survey (versions, compatibility)
- [x] Create comprehensive plan (`agents/plans/01-init.md`)
- [ ] Database expert review
- [ ] UI/UX expert review
- [ ] Security expert review
- [ ] Revise plan based on reviews
- [ ] Create `.copilot-instructions.md`

## Phase 1: Project Scaffold
- [ ] Initialize SvelteKit project with Svelte 5
- [ ] Configure Volta (node@24) + pnpm via corepack
- [ ] Install all dependencies
- [ ] Configure adapter-cloudflare
- [ ] Configure Tailwind CSS v4
- [ ] Configure TypeScript strict mode
- [ ] Set up wrangler.toml for D1
- [ ] Create .gitignore
- [ ] Git init + push to GitHub

## Phase 2: Database
- [ ] Write migration 0001_create_users.sql
- [ ] Write migration 0002_create_passkey_credentials.sql
- [ ] Write migration 0003_create_posts.sql
- [ ] Write migration 0004_create_comments.sql
- [ ] Write migration 0005_create_votes.sql
- [ ] Write migration 0006_create_rate_limits.sql
- [ ] Write migration 0007_create_bans.sql
- [ ] Write migration 0008_create_challenges.sql

## Phase 3: Auth System
- [ ] Server: JWT sign/verify utilities (`src/lib/server/auth.ts`)
- [ ] Server: Username generation (`src/lib/server/username.ts`)
- [ ] API: GET /api/auth/challenge
- [ ] API: POST /api/auth/register
- [ ] API: POST /api/auth/authenticate
- [ ] API: POST /api/auth/recover
- [ ] API: GET /api/auth/me
- [ ] API: PATCH /api/auth/me
- [ ] Client: Passkey browser helpers (`src/lib/utils/passkey.ts`)
- [ ] Client: Auth store (`src/lib/stores/auth.ts`)
- [ ] Client: API fetch wrapper (`src/lib/utils/api.ts`)

## Phase 4: Posts & Comments
- [ ] API: GET /api/posts (with sorting/pagination)
- [ ] API: POST /api/posts
- [ ] API: GET /api/posts/[id]
- [ ] API: GET /api/posts/[id]/comments
- [ ] API: POST /api/posts/[id]/comments

## Phase 5: Voting
- [ ] API: POST /api/votes

## Phase 6: Rate Limiting & Bans
- [ ] Server: Rate limit middleware (`src/lib/server/ratelimit.ts`)
- [ ] Rate limiting on all POST endpoints
- [ ] Auto-ban logic
- [ ] Clear error responses for agents

## Phase 7: Frontend
- [ ] Root layout (`+layout.svelte` + `+layout.ts`)
- [ ] Header component
- [ ] HeroBanner component
- [ ] FilterTabs component
- [ ] PostCard component
- [ ] PostList component
- [ ] VoteButtons component
- [ ] Home page (`/`)
- [ ] Post detail page (`/post/[id]`)
- [ ] CommentItem component
- [ ] CommentSection component
- [ ] Submit page (`/submit`)
- [ ] PasskeyAuth component (modal)
- [ ] BackupCodeModal component
- [ ] Footer component

## Phase 8: Agent-facing Files
- [ ] `/static/skill.md` — AI skill file
- [ ] `GET /api/heartbeat` — health check

## Phase 9: CI/CD
- [ ] `.github/workflows/deploy.yml`
- [ ] Type check step
- [ ] Build step
- [ ] Deploy to Cloudflare Pages

## Phase 10: Polish & Deploy
- [ ] Dark theme styling
- [ ] Humor copy and tone throughout
- [ ] Mobile responsive check
- [ ] Final type check passes
- [ ] README.md update
- [ ] Git push to GitHub
- [ ] Verify deployment
