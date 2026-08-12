# Tasks: Supabase PostgreSQL Deployment

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 80–140 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single work unit |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
800-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Node declaration and sanitized acceptance evidence | Single PR | `pnpm lint && pnpm exec tsc --noEmit && pnpm build` | Fresh Preview sequence after human checkpoint | `package.json`, change evidence only |

## Phase 1: Guardrails and Evidence

- [x] 1.1 **Agent:** Capture `git status`, protected-path and `package.json` build-script baselines; preserve the existing `.gitignore` change without staging, cleaning, or editing it.
- [x] 1.2 **Agent RED:** In `openspec/changes/supabase-postgres-deployment/evidence.md`, record fail-closed tests for wrong/relative/absolute repository selectors and PR `merge`, `edit`, `review`, `close`, environment-prefix, and composed commands; permit only fixed-cwd read-only `view`, `checks`, and `diff`.
- [x] 1.3 **Agent:** Create the sanitized evidence checklist at `openspec/changes/supabase-postgres-deployment/evidence.md`; allow only booleans, masked scope metadata, exit codes, counts, SHA placeholders, and pass/fail results—never values, hosts, identities, raw logs, screenshots, or command history.

## Phase 2: Repository and Human Checkpoints

- [x] 2.1 **Agent GREEN:** Add only `engines.node: "24.x"` to `package.json`; do not alter `scripts.build`, `pnpm-lock.yaml`, Prisma schema/migrations, seed paths, `.gitignore`, or repository environment files.
- [x] 2.2 **Agent:** Run protected-path/build checks plus `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` under Node 24; fail acceptance if build invokes migration or seed behavior.
- [x] 2.3 **Human-only:** Provision one empty Supabase Free project; set Vercel Node 24.x and transaction-pooled `POSTGRES_URL` plus one stable `AUTH_SECRET` for Preview and Production. Confirm masked scope only.
- [x] 2.4 **Human-only:** Privately run exactly `pnpm exec prisma migrate deploy` with a session-mode URL, then unset it and record sanitized success. On failure, halt: no retry, seed, rollback, smoke, or URL retention.

## Phase 3: Preview and PR Assessment

- [x] 3.1 **Human-only:** After migration success, deploy Preview and use a fresh browser context for disposable registration → login → dashboard → exercises → workouts → logout; fail if a step is skipped or protected empty states fail.
- [x] 3.2 **Agent:** Record only sanitized READY, Node-major, migration-free/seed-free, and smoke pass/fail facts in `evidence.md`; verify no secret disclosure or prohibited-path diff.
- [x] 3.3 **Agent:** Perform fixed-cwd read-only PR #1 `view`, `checks`, and `diff` assessment; report its 4,939 changed lines against the 800-line budget and missing approval as blocked, with zero mutation and no merge.

## Phase 4: Acceptance and Rollback

- [x] 4.1 **Agent:** Re-run scope audit and finalize `evidence.md`; acceptance requires every checklist gate and never exposes secrets or modifies protected paths.
- [x] 4.2 **Human-only:** Before migration, remove external configuration/revert `package.json` and discard the empty project if needed; after migration, disable deployments/secrets and choose a forward fix—never down-migrate automatically.
