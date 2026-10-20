# Launch Minimums (F0.3)

Objective: redirect `/`, remove the public `/api/seed` route, and declare `lang="es"`.
Branch: `feat/launch-minimums` · Delivery: single PR into `master` (forecast < 100 lines) · Runner: Vitest (`pnpm test`).
Notion: https://app.notion.com/p/3e0b57b76c9b8145af24e06e065e42d2

## Specs

- S1: Visiting `/` without a session redirects to `/auth/login`; with a session it redirects to `/dashboard`. No landing page. Must not break the edge-safe middleware (`src/auth.config.ts` `authorized` callback).
- S2: `GET /api/seed` no longer exists (`src/app/api/seed/route.ts` deleted) and nothing in the repo references it outside archived/historical documents.
- S3: The root document declares `lang="es"` (`src/app/layout.tsx`).
- S4: CI gates pass: `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`.
- Out of scope: `pnpm seed` (`src/seed/index.ts`), landing page, password recovery, email verification, dark mode, full i18n.

## Tasks

- [x] T1 (S1) — RED/GREEN: `authorized` callback redirects `/`; tests also pin previous behavior of the callback. Route: inline.
- [x] T2 (S2) — Delete the seed route; check live references (README, scripts, CI, docs). Route: inline.
- [x] T3 (S3) — `lang="es"`. Route: inline.
- [ ] T4 (S4) — Run all CI gates; archive change, update Notion. Route: inline.

## Log

- L1 (2026-10-19): "Sí, arranquemos con F0.3. Verifica la posibilidad de qué tareas se pueden ejecutar en paralelo con otros agentes, tenemos a disposición opencode y antigravity cli antes de ejecutarlos pideme el comando para que arranques cada agente"
- L2 (2026-10-19): "Vale, vamos con tu recomendación" — route decision: all tasks inline (about 20 changed lines; no writer trigger holds), no OpenCode/Antigravity.
- Risk note: item 2 touches the auth `authorized` guard; item 3 removes a public route (not consumed by anything in the repo).
- Evidence (2026-10-19): RED observed (2 root-redirect tests failed, 4 prior-behavior tests passed); GREEN after the change. `pnpm test` 415/415, `lint`, `format:check`, `tsc --noEmit`, `build` all exit 0. No live references to `/api/seed` outside archived/historical OpenSpec docs.
- Risk: item 2 (auth `authorized` guard, `/` branch only; prior behavior pinned by tests) and removal of an unconsumed public route.
- Finding (2026-10-19, browser check): `next.config.mjs` already had `redirects()` sending `/` -> `/dashboard` (308 permanent), which ran before the middleware, so the new `authorized` branch was dead code and logged-out users ended at `/auth/login?origin=/dashboard`. Removed it so the callback is the single source. Re-verified: `curl /` -> 302 `/auth/login`; DOM `lang="es"`; `/api/seed` -> 404; all CI gates exit 0. Logged-in case (`/` -> `/dashboard`) covered by unit test only, not yet checked in the browser.
- Risk: item 3-adjacent (removes a permanent redirect on `/`; previously cached 308 in browsers may linger until cleared, harmless since `/` now redirects anyway).
- Browser check (2026-10-19, agent-browser): logged out `/` -> `/auth/login`; logged in `/` -> `/dashboard`; `lang="es"`; `/api/seed` 404. Created local test user via the register UI (credentials in gitignored `.env.local` as `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`).
- Side finding (pre-existing, not fixed): submitting the register form before React hydrates falls back to a native GET and puts the password in the URL query string. Candidate for a backlog ticket.
