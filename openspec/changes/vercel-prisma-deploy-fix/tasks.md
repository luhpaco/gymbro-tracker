# Tasks: Vercel Prisma Deploy Fix

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 20–45 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Make Prisma generation and versions deterministic | Single PR | `pnpm install --frozen-lockfile && pnpm exec prisma version` | `pnpm build`; generation logs precede Next.js output | Revert `package.json` and `pnpm-lock.yaml` together |
| 2 | Prove Vercel acceptance | Same PR evidence | Inspect preview/production logs for `pnpm build` and successful generation | Redeploy the accepted commit: preview, then production | Redeploy the last known-good commit after reverting both files |

## Phase 1: Manifest and Lockfile

- [x] 1.1 Modify `package.json`: set `build` to `prisma generate && next build`; pin `@prisma/client` and `prisma` to `5.18.0` without ranges.
- [x] 1.2 Refresh `pnpm-lock.yaml` from the manifest; retain only aligned `5.18.0` Prisma client, CLI, and engine entries; reject unrelated churn.

## Phase 2: Local Contract Validation

- [x] 2.1 Run `pnpm install --frozen-lockfile` and `pnpm exec prisma version`; record that CLI and client both report `5.18.0`.
- [x] 2.2 Run `pnpm build`; capture that `prisma generate` succeeds before `next build` starts.
- [x] 2.3 Perform a controlled negative smoke check of the committed `&&` chain; record non-zero generation failure and that `next build` is not invoked (no test runner is configured).
- [x] 2.4 Run `pnpm lint` and `pnpm exec tsc --noEmit`; record outcomes as existing quality gates.

## Phase 3: Vercel Acceptance Evidence

- [ ] 3.1 Redeploy the accepted commit to Vercel preview; retain logs proving `pnpm build`, Prisma generation before Next.js, and successful completion.
- [ ] 3.2 Redeploy the same commit to Vercel production; retain equivalent successful-build evidence.
- [ ] 3.3 If either environment bypasses `pnpm build`, identify it, block acceptance, and correct the project-level setting outside this repository before repeating evidence.

## Phase 4: Delivery Record

- [ ] 4.1 Commit `package.json` and `pnpm-lock.yaml` with local validation evidence; keep the two-file rollback boundary intact.
- [ ] 4.2 Record preview and production deployment URLs/log excerpts with the release handoff; do not add Node, route, Auth, schema, or repository Vercel changes.
