# Tasks: Reference Data Provisioning

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 300–390 |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR: migration, disposable validation, and sanitized evidence |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Guarded migration plus fixture validator | PR 1 | `pnpm exec ts-node scripts/validate-reference-data-provisioning.ts` | `docker compose up -d`; disposable local DB | New migration and validator only |
| 2 | Sanitized evidence and smoke handoff | PR 1 | `pnpm lint && pnpm exec tsc --noEmit` | N/A: evidence/handoff only | New evidence and handoff files only |

## Phase 1: Disposable Validation Foundation

- [x] 1.1 Create `scripts/validate-reference-data-provisioning.ts` with disposable PostgreSQL fixtures for fresh, upgrade, divergence, retry, preservation, collision, concurrent-deploy, and competing-writer cases; never log connection data.
- [x] 1.2 RED: run the validator before adding the migration; require missing canonical pairs and the migration-path assertion to fail without invoking `pnpm seed`, `/api/seed`, or `pnpm build`.
- [x] 1.3 RED: assert collision returns `P0001`/`reference_data_provisioning_incompatible_state`, and concurrent deploy/writer cases roll back or time out with unchanged rows and exercise FKs.

## Phase 2: Forward-Only Migration

- [x] 2.1 Create only `prisma/migrations/<timestamp>_provision_muscle_groups/migration.sql`; preserve historical migrations, schema, canonical TypeScript data, seeds, API route, UI, and package scripts.
- [x] 2.2 Implement `BEGIN`, 10-second local lock timeout, `SHARE ROW EXCLUSIVE` lock, static `P0001` collision precheck, and tag-only `MERGE` of exactly fourteen canonical pairs; commit atomically.
- [x] 2.3 GREEN: run the validator against disposable fixtures; prove fresh/partial/retry convergence, name-only reconciliation, stable IDs/tags/counts/FKs, and preservation of extra/user-owned data.

## Phase 3: Guarded Verification and Evidence

- [x] 3.1 Add `openspec/changes/reference-data-provisioning/validation-evidence.md` with sanitized outcomes, canonical parity/count assertions, historical-file checksum/diff guard, and no-seed/no-build invocation proof.
- [x] 3.2 Run and record `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`; retain commands, exit status, counts, checksums, and failure class only—never secrets or URLs.
- [x] 3.3 Verify recovery guidance in evidence: private reviewed correction, `prisma migrate resolve --rolled-back <migration>`, unchanged reapply; applied defects use a new forward migration only.

## Phase 4: Deployment-Smoke Handoff

- [x] 4.1 Create `openspec/changes/reference-data-provisioning/smoke-handoff.md` declaring eligibility to repeat the existing blocked deployment smoke after separately authorized target deployment; do not run it.
- [x] 4.2 Confirm the handoff does not edit `openspec/changes/supabase-postgres-deployment/`, platform settings, sample exercises, or management UI.
