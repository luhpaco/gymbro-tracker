# Tasks: CI Pipeline + CodeRabbit Review Configuration

## Review Workload Forecast

(This change's confirmed review budget is 800 changed lines this session, not the 400-line default; risk below is assessed against 800.)

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1: n/a (size:exception) · PR2: ~400–500 |
| 800-line budget risk (PR2) | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 format pass (size:exception) → PR 2 CI + CodeRabbit + Vitest Stage 1 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No (chain strategy and PR1 size:exception already confirmed by user this session)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Repo-wide Prettier adoption, mechanical, no behavior change | PR 1 | `pnpm exec prettier --check .` | `pnpm build` (local only — no CI exists yet) | Revert commit; drops prettier config + reformatted files, no runtime behavior change |
| 2 | CI gate + CodeRabbit config + Vitest Stage 1 | PR 2 | `pnpm test` | Actual GitHub Actions run on the PR itself (first execution of the workflow it introduces) | Revert commit; drops `ci.yml`/`.coderabbit.yaml`/vitest config/tests, no app runtime impact |

## Phase 1: PR 1 — format: repo-wide Prettier pass (size:exception)

- [x] 1.1 Add `prettier` devDep (`package.json`).
- [x] 1.2 Add `.prettierrc` per design.md rules (tabs, `jsxSingleQuote`, `printWidth: 80`, `trailingComma: "all"`, JSON/YAML override to 2-space).
- [x] 1.3 Add `.prettierignore` per design.md scope list (`.next/`, `node_modules/`, `prisma/migrations/`, `pnpm-lock.yaml`, `openspec/`, `*.md`, etc.).
- [x] 1.4 Add `format`/`format:check` scripts (`package.json`).
- [x] 1.5 Run `pnpm exec prettier --write .` once; commit the reformatted ~70 files as this PR's sole content.
- [x] 1.6 Verify locally: `pnpm build` and `pnpm lint` pass post-format (no CI exists yet).

## Phase 2: PR 2 — ci: pipeline + CodeRabbit config (branch from `master` only after PR 1 merges)

- [ ] 2.1 Add `.coderabbit.yaml` per design.md (`profile: chill`, `auto_review.enabled: true`, `path_instructions` for Zod/Prisma/kebab-case/`@/` conventions, `path_filters` excluding `design/**` and `openspec/changes/archive/**`, no-suggestion guidance on `prisma/migrations/**`).
- [ ] 2.2 Add `.github/workflows/ci.yml` per design.md (`on.pull_request.branches: [master]` only, pinned toolchain via `pnpm/action-setup@v4` + `setup-node`, placeholder `POSTGRES_URL`/`AUTH_SECRET` env vars, 7 sequential steps ending `pnpm build`).
- [ ] 2.3 Add `eslint-config-prettier` devDep; append `"prettier"` last in `.eslintrc.json` `extends`.
- [ ] 2.4 Add `vitest` + `vite-tsconfig-paths` devDeps.
- [ ] 2.5 Add `vitest.config.ts` per design.md (`environment: "node"`, `vite-tsconfig-paths` plugin, `include: ["src/**/*.test.ts"]`).
- [ ] 2.6 Add `test`/`test:watch` scripts (`package.json`).
- [ ] 2.7 Write store tests: `src/store/ui/ui-store.test.ts`, `src/store/exercises/exercises-store.test.ts`, `src/store/workouts/workouts-store.test.ts`, `src/store/workout/workout-store.test.ts` (pure state transitions, reset between tests).
- [ ] 2.8 Write `src/lib/schemas/workout-set.test.ts` (Zod `safeParse` happy path + `min` violations + coercion) and `src/lib/utils.test.ts` (`cn` merge precedence + conditional classes).
- [ ] 2.9 Flip `openspec/config.yaml` `testing` block: `strict_tdd: true`, `runner.available: true`, `runner.framework: vitest`, `runner.command: pnpm test`.
- [ ] 2.10 Update `CLAUDE.md` "Testing" section: Vitest runner and Prettier formatter now configured.
- [ ] 2.11 Verify locally: `pnpm lint`, `pnpm exec prettier --check .`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm exec prisma validate`, `pnpm build` all pass; confirm the actual GitHub Actions run is green on the PR itself.
