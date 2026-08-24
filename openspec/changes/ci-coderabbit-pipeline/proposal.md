# Proposal: CI Pipeline + CodeRabbit Review Configuration

## Intent

Nothing currently gates a PR into `master`: no `.github/`, no test runner, no formatter, no CodeRabbit config. Quality depends on an agent remembering to run `pnpm lint`/`pnpm build` — precisely what CLAUDE.md hard rule #1 ("never trust 'task done' summaries") forbids relying on. This change makes verification machine-enforced and gives the already-installed CodeRabbit GitHub App repo-specific instructions so its review reflects this project's conventions instead of generic advice.

## Scope

### In Scope

- `.coderabbit.yaml` — `path_instructions` encoding CLAUDE.md conventions (Zod on `src/actions/**`, Prisma confined to `src/lib/`/`src/data/`, kebab-case files, `@/` alias), `path_filters` excluding `design/**` and `openspec/changes/archive/**`, no manual-edit flags on `prisma/migrations/**`, `auto_review.enabled: true`.
- `.github/workflows/ci.yml` — one sequential job on `pull_request` → `master`: checkout → node/pnpm pinned from `engines`/`packageManager` → `pnpm install --frozen-lockfile` → placeholder `POSTGRES_URL`/`AUTH_SECRET` (never real secrets) → `pnpm lint` → `prettier --check .` → `tsc --noEmit` → `pnpm test` → `prisma validate` → `pnpm build`.
- Prettier: `prettier` + `eslint-config-prettier` devDeps, `.prettierrc`, `.prettierignore`, `format`/`format:check` scripts, `prettier` appended last in `.eslintrc.json` `extends`. Repo-wide format pass as its **own separate commit**.
- Vitest Stage 1 (minimal): `vitest` + `vite-tsconfig-paths`, `vitest.config.ts` (`environment: 'node'`), `test`/`test:watch` scripts, tests for `src/store/**/*-store.ts`, `src/lib/schemas/workout-set.ts`, `src/lib/utils.ts`.
- Flip `openspec/config.yaml` `testing` block **and** CLAUDE.md "Testing" section together.

### Out of Scope

- Stage 2 mock-based server-action/component tests (needs the React testing stack; no seam exists yet).
- Stage 3 Postgres service-container integration tests.
- Branch protection rules on `master` (shared repo settings — needs separate user go-ahead).
- Dependabot config; husky/lint-staged pre-commit hooks.
- Notion backlog ticket (post-archive follow-up, not in this diff).

## Capabilities

### New Capabilities

- `pull-request-quality-gate`: deterministic automated verification of every PR into `master`.
- `automated-code-review`: repo-scoped CodeRabbit review configuration and its guidance contract.

### Modified Capabilities

- None.

## Approach

**Resolved decision — Stage 1 Vitest scope: Approach 1 (minimal).** Install only `vitest` + `vite-tsconfig-paths`. Stage 1's targets are pure logic (Zustand stores, one Zod schema, `utils.ts`); no component is rendered, so `@testing-library/react@^16`, `jest-dom`, `jsdom`, and `@vitejs/plugin-react` would ship unused. Stage 2 adds them when it actually tests components. Rationale: YAGNI, smaller reviewable diff, and it avoids pinning React-19-sensitive versions months before first use.

**Single sequential CI job** over parallel jobs: small repo, cheapest YAML, one pass/fail signal. Splitting is a low-risk follow-up if wall-clock time becomes painful.

Order matters within the job: cheap checks (lint, format, types) fail fast before `pnpm test` and the expensive `pnpm build`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.coderabbit.yaml` | New | Review profile, path instructions, path filters |
| `.github/workflows/ci.yml` | New | Single sequential PR gate job |
| `.prettierrc`, `.prettierignore`, `vitest.config.ts` | New | Formatter + test-runner config |
| `package.json` | Modified | 4 devDeps; `test`, `test:watch`, `format`, `format:check` |
| `.eslintrc.json` | Modified | `prettier` appended last in `extends` |
| `src/store/**`, `src/lib/utils.ts`, `src/lib/schemas/workout-set.ts` | New tests | Colocated `*.test.ts` |
| `openspec/config.yaml`, `CLAUDE.md` | Modified | Testing/formatter facts flipped together |
| Repo-wide | Modified | One-time format pass, separate commit |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `.env.template` key list inferred, not read (tool denies `.env*`) | Med | `sdd-apply` reads it directly, or human confirms once before CI env vars are frozen |
| `next build` may need `AUTH_SECRET` at compile time — unverified | Med | Real `pnpm build` dry run with placeholders only, early in apply, before wiring the workflow |
| Repo-wide format pass mixed into the tooling diff makes review impossible | Med | Hard requirement: separate commit; tooling commit stays reviewable |
| `eslint-config-prettier` ordering wrong → rules conflict | Low | Must be last in `extends`; verified by `pnpm lint` + `format:check` both passing |
| Toolchain drift (pnpm 11.21.0 / node 24.x) breaks `--frozen-lockfile` | Low | Pin from `packageManager`/`engines`, do not float |
| New gate blocks in-flight PRs | Low | No branch protection in this change; checks are advisory until the user enables them |

## Rollback Plan

Every deliverable is additive and independently revertable:

1. Delete `.github/workflows/ci.yml` — CI stops immediately, no repo state to unwind.
2. Delete `.coderabbit.yaml` — CodeRabbit falls back to defaults; the App stays installed.
3. `git revert` the format-pass commit alone if it caused churn; tooling stays.
4. Remove devDeps + scripts and restore `openspec/config.yaml` / CLAUDE.md testing blocks to `runner.available: false`.

No migrations, no schema change, no data mutation. Nothing is irreversible.

## Dependencies

- CodeRabbit GitHub App already installed on this repo (confirmed by the user) — webhook-driven, needs no CI step or token.
- GitHub Actions enabled for the repository.
- Existing `pnpm-lock.yaml` (required for `--frozen-lockfile`).

## Success Criteria

- [ ] A PR into `master` runs one CI job that fails on a lint, format, type, test, schema, or build error.
- [ ] `pnpm test` exists and runs green tests for the three Stage 1 targets.
- [ ] `pnpm exec prettier --check .` passes repo-wide with no follow-up churn.
- [ ] `pnpm lint` passes with `eslint-config-prettier` active (no rule conflicts).
- [ ] CodeRabbit auto-reviews new PRs and cites this repo's conventions, ignoring `design/**` and archived changes.
- [ ] `openspec/config.yaml` and CLAUDE.md agree on the runner/formatter facts — neither still says "no test runner configured".
