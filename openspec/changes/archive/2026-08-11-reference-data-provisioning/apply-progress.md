# Apply Progress: Reference Data Provisioning

## Completed

- Tasks 1.1–1.3: Added and exercised an isolated disposable PostgreSQL validator, including the RED missing-migration guard, collision rollback, concurrent execution, and writer-timeout coverage.
- Tasks 2.1–2.3: Added `20260811140000_provision_muscle_groups`, a single forward-only, transactional tag-keyed reconciliation migration for the fourteen canonical pairs.
- Tasks 3.1 and 3.3: Recorded sanitized validation, checksum/diff guards, and forward-only recovery guidance.
- Task 3.2: Recorded the already-proven scoped quality outcomes, including the Node 24 build.
- Tasks 4.1–4.2: Created an isolation-preserving smoke handoff and confirmed no out-of-scope deployment, platform, sample-exercise, or management-UI mutation.

## Evidence

- Focused validator: pass (exit `0`).
- Lint: pass (exit `0`, one pre-existing warning outside this change).
- TypeScript: pass (exit `0`).
- Build: pass (exit `0`) via `fnm exec --using=24 pnpm build` under Node 24.
- Evidence revision: `validation-evidence.md@sha256:161b207b14318d5abe53a69776a54237dd38c0760d15f67748f6cca7b042c76b`.
- No seed, HTTP seed, configured database, deployment, or separate deployment-change action was used.
- Work unit evidence: focused quality commands passed; runtime harness is N/A because this batch records evidence and creates a handoff only. Rollback boundary: this change's validation evidence, apply-progress, task checkboxes, and smoke handoff.

## Smoke Handoff

- Repeating the separate `supabase-postgres-deployment` smoke requires a separately authorized target deployment and a user-run private migration.
- This change does not perform the smoke or edit the separate change.

## Rollback Boundary

This evidence-and-handoff work unit is limited to this change's validation evidence, apply-progress, task checkboxes, and smoke handoff. Remove only those uncommitted artifact files to abandon this work unit. After a migration is applied, use a new forward migration; never rewrite or delete historical migration data.
