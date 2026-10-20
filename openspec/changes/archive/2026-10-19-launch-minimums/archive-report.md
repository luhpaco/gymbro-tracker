# Archive Report: Launch Minimums

## Summary

**Change**: `launch-minimums` (Notion F0.3)
**Archived to**: `openspec/changes/archive/2026-10-19-launch-minimums/`
**Date**: 2026-10-19
**Final revision**: `01ecba706bd356c847f174fd6764bb3e33965469` (`origin/master`, merge of PR #54)

## What Was Implemented

| Capability | Requirements | Scenarios | Status |
|---|---:|---:|---|
| `launch-minimums` | 3 | 4 | Created (new durable spec) |

- `/` redirects through the `authorized` callback (`src/auth.config.ts`); the static 308 in `next.config.mjs` was removed because it ran before the middleware.
- `src/app/api/seed/route.ts` deleted; `pnpm seed` untouched.
- `<html lang="es">`.

## Verification

- Vitest `src/auth.config.test.ts` (RED observed first) plus all CI gates passed.
- Browser check with agent-browser: logged out `/` -> `/auth/login`, logged in `/` -> `/dashboard`, `lang="es"`, `/api/seed` -> 404.

## Delivery

Single PR #54 into `master`, merged by the owner through the ruleset bypass.

## Follow-ups

- Bug ticket: register form submitted before hydration falls back to a native GET and leaks the password into the URL (Notion backlog).
