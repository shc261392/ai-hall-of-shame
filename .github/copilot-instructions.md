# Copilot Instructions for AI Hall of Shame

## CRITICAL: Never Read .env Files

**NEVER read, display, print, log, or output the contents of `.env`, `.env.local`, `.env.*.local`, or any file containing live credentials.**

This is a hard rule with no exceptions. If asked to debug environment issues, suggest checking variable names only — never read the file content.

## Project Overview

See `.copilot-instructions.md` in the repository root for full project context, architecture, code conventions, and security rules.

## Quick Reference

- **Stack**: SvelteKit 2 + Svelte 5 runes, Tailwind CSS v4, TypeScript strict
- **Backend**: SvelteKit API routes (`+server.ts`) as Cloudflare Workers Functions
- **DB**: Cloudflare D1 (SQLite) — always use `db.prepare().bind()`, never string interpolation
- **Auth**: WebAuthn passkeys + JWT bearer tokens (no cookies, stored in sessionStorage)
- **Deploy**: `pnpm deploy` (builds then deploys to Cloudflare Pages)

## Do Not

- Read `.env` files
- Use `{@html}` with user-provided content
- Interpolate user input into SQL strings
- Add `export let` (use `$props()` instead — Svelte 5)
- Use `$:` reactive statements (use `$derived` / `$effect` instead — Svelte 5)
- Enable SSR (this is an SPA — `ssr: false`)
