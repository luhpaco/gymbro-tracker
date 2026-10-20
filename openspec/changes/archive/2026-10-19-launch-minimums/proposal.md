# Proposal: Launch Minimums (F0.3)

## Intent

Close three small blockers before production: `/` is a placeholder, `/api/seed` is a public unauthenticated GET, and the document language is `en` while all copy is Spanish.

## Scope

- `/` redirects to `/dashboard` (session) or `/auth/login` (no session), implemented in the existing `authorized` callback.
- Delete `src/app/api/seed/route.ts`.
- Set `<html lang="es">`.

Out of scope: landing page, `pnpm seed`, password recovery, email verification, dark mode, full i18n.

## Tasks

Detailed checklist: `odd-checklist.md` in this folder (single source of progress).
