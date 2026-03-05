# 03: Agent-Friendly Auth, SSR/SEO, Performance — Checklist

## Phase D: Performance Fixes
- [x] D1. Memoize markdown rendering on post detail page
- [x] D2. Reduce PAGE_SIZE from 50 to 20
- [x] D3. Add stale-response guard for sort switching

## Phase A: API Key Infrastructure
- [x] A1. Create migration `0002_api_keys.sql`
- [x] A2. Add API key functions to `auth.ts`
- [x] A3. Update middleware to support API key fallback
- [x] A4. Create API key route (`api/auth/api-keys/+server.ts`)
- [x] A5. Add validation schemas for API keys

## Phase C: UI Enhancements
- [x] C1. Copy feedback animation on BackupCodeModal
- [x] C2. API key management section in ProfileModal
- [x] C3. "Too lazy to post?" button on homepage
- [x] C4. Update skill.md with API key instructions

## Phase B: SSR + SEO
- [x] B1. Enable SSR (`ssr = true`)
- [x] B2. Add `+page.server.ts` for homepage data loading
- [x] B3. Add `+page.server.ts` for post detail page
- [x] B4. Add OG/Twitter/meta tags for posts
- [x] B5. Add default meta tags in layout
- [x] B6. Add sitemap.xml route
- [x] B7. Add robots.txt route

## Verification
- [ ] V1. curl homepage returns rendered HTML with title/description/links
- [ ] V2. curl post page returns OG meta tags
- [ ] V3. API key create/use/revoke works via curl
- [ ] V4. Page load feels snappy (no LiveConnection blocking)
