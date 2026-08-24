## Exploration: ci-coderabbit-pipeline

### Current State
No CI or code-quality tooling exists today: no `.github/` directory, no `.coderabbit.yaml`, no CODEOWNERS, no PR template. `package.json` has `packageManager: pnpm@11.21.0`, `engines.node: 24.x`, no `test` script, and `pnpm-lock.yaml` is present (frozen-lockfile install is viable in CI). `.eslintrc.json` is bare legacy format (`{"extends": "next/core-web-vitals"}`) on ESLint `9.39.5` / `eslint-config-next` `15.5.23`. `tsconfig.json` has `strict: true` and the `@/*` → `./src/*` path alias, with no `.nvmrc` — `package.json`'s `packageManager`/`engines` fields are the sole toolchain-pinning source for CI.

`prisma/schema.prisma` reads `env("POSTGRES_URL")`. `prisma generate`/`validate` fail on this unset variable even with no real DB connection attempted — this is a hard CI blocker, not cosmetic. The only app-consumed env var confirmed via grep beyond DB/auth is `NEXT_PUBLIC_MAINTENANCE_MODE` (has a safe default); NextAuth v5 implicitly needs `AUTH_SECRET`. `.env.template`'s exact key list could not be read directly (tool-level `.env*` permission denial) — inferred from code, not verified verbatim.

No test files exist anywhere. Server actions under `src/actions/**` (auth/, exercise/, muscle/, workout/) inline `auth()` + direct `prisma.<model>.*` calls with no repository/service abstraction, swallowing errors via try/catch → `console.error` + fallback return (e.g. `create-workout.ts`, `get-exercises.ts`) — these have no test seam without mocking `@/lib/prisma` (globalThis-cached singleton) and `@/auth`. By contrast, `src/store/**/*-store.ts` (Zustand: exercises/, ui/, workout/, workouts/) are pure state transitions with no I/O, `src/lib/schemas/workout-set.ts` is a small isolated Zod schema, and `src/lib/utils.ts` holds plain utility functions — all three are easy, dependency-free unit-test targets. `src/data/*` are static seed arrays, not logic to test.

`openspec/config.yaml`'s `testing` block and `CLAUDE.md`'s "Testing" section both currently and correctly document "no runner configured"; both need to flip together with this change.

CodeRabbit's `.coderabbit.yaml` schema (confirmed live, docs.coderabbit.ai) exposes `language`, `reviews.profile`, `reviews.auto_review.enabled`, `reviews.path_instructions` (`{path, instructions}` — per-path review guidance), and `reviews.path_filters` (glob list, `!`-prefixed entries exclude) — `path_filters` is the correct field for excluding `design/**` and `openspec/changes/archive/**` from review, not `path_instructions`.

### Affected Areas
- `.coderabbit.yaml` (new) — repo-root config using `path_instructions` for convention guidance and `path_filters` for exclusions.
- `.github/workflows/ci.yml` (new) — single sequential job: checkout → pinned pnpm/node setup (from `packageManager`/`engines`) → `pnpm install --frozen-lockfile` → placeholder `POSTGRES_URL`/`AUTH_SECRET` env vars → `pnpm lint` → `pnpm exec prettier --check .` → `pnpm exec tsc --noEmit` → `pnpm test` → `pnpm exec prisma validate` → `pnpm build`.
- `package.json` — new devDeps (`prettier`, `eslint-config-prettier`, `vitest`, plus Stage 1 test devDep set — see Risks) and new scripts (`format`, `format:check`, `test`, `test:watch`).
- `.prettierrc`, `.prettierignore` (new).
- `vitest.config.ts` (new) — needs `vite-tsconfig-paths` to resolve the `@/*` alias inside test files (per Next.js's official Vitest guide); not in the original plan-mode devDep list.
- `.eslintrc.json` — append `prettier` last in `extends` to disable conflicting stylistic rules.
- New test files for `src/store/**/*-store.ts`, `src/lib/schemas/workout-set.ts`, `src/lib/utils.ts`.
- `openspec/config.yaml` (`testing` block) and `CLAUDE.md` ("Testing" section) — flip together to reflect the new runner.
- A separate one-time repo-wide Prettier formatting commit, kept out of the tooling-change diff.

### Approaches
1. **Minimal pure-logic Vitest (Stage 1) vs. full React-testing stack now** — Stage 1's actual targets (Zustand stores, one Zod schema, `src/lib/utils.ts`) are pure logic with no component under test, so `vitest` + `vite-tsconfig-paths` alone is sufficient; `@testing-library/react` (must be `^16`+ for React 19 peer/type compatibility) + `jest-dom` + `jsdom` would only be needed once component tests are added.
   - Pros: smaller devDependency surface, faster CI, matches the stated Stage 1 scope exactly.
   - Cons: the React-testing stack has to be added again in Stage 2 when server-action/component tests start.
   - Effort: Low
2. **Full stack now (as originally scoped in plan mode)** — install `@testing-library/react`/`jest-dom`/`jsdom` alongside `vitest` even though nothing exercises them yet.
   - Pros: Stage 2 can start writing component/action tests without another dependency-setup pass.
   - Cons: dead weight in `package.json` until Stage 2 actually lands; slightly larger CI install.
   - Effort: Low (same setup cost either way, differs only in unused deps)
3. **Single sequential CI job vs. parallel jobs** — recommend single sequential job; this is a small repo and a first pipeline, split later only if runtime becomes a pain point.
4. **CI-only enforcement vs. husky/lint-staged pre-commit hooks** — recommend CI-only; pre-commit hooks weren't requested and would widen scope.

### Recommendation
Proceed to `sdd-propose` with: the single sequential `ci.yml` job described above; `.coderabbit.yaml` using `path_filters` for exclusions and `path_instructions` for per-path convention guidance (Zod validation on `src/actions/**`, Prisma confined to `src/lib/`/`src/data/`, no manual edits flagged under `prisma/migrations/**`); and an explicit decision in `sdd-propose` on Approach 1 vs. 2 for the Stage 1 Vitest devDep scope (leaning Approach 1 — minimal — to match the stated pure-logic-only scope of this change). Server-action mock-based tests (Stage 2), Postgres-integration tests in CI (Stage 3), branch protection on `master`, and Dependabot remain explicitly out of scope — documented as follow-ups, not built here.

### Risks
- `.env.template`'s exact key list is inferred from code, not read verbatim (tool-level `.env*` permission denial) — confirm it once by hand before `sdd-design` finalizes the CI placeholder env vars.
- Whether `next build` truly needs a placeholder `AUTH_SECRET` at compile time (vs. only at runtime) is unverified — recommend one real `pnpm build` dry run early in `sdd-apply` before wiring the full CI workflow around it.
- Stage 1 Vitest devDep scope (Approach 1 minimal vs. Approach 2 full stack) is an open decision for `sdd-propose`, not yet resolved.
- `openspec/config.yaml` and `CLAUDE.md`'s Testing section must be updated in the same change, or they immediately go stale relative to the new runner.

### Ready for Proposal
Yes — propose a config/tooling change (`.coderabbit.yaml`, `.github/workflows/ci.yml`, Prettier config, Vitest config + Stage 1 tests, doc updates) with the Stage 1 devDep-scope decision made explicit, plus a real `pnpm build`/`pnpm test` dry run as part of verification. Expected diff is moderate (new config files + several small test files + one separate formatting commit) — track against the 800-line review budget already agreed with the user; ask before proceeding only if the tasks-phase forecast flags actual risk.
