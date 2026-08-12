# Archive Report: Supabase PostgreSQL Deployment

## Final State

- Change: `supabase-postgres-deployment`
- Archived: 2026-08-12
- Verdict: archived with pass verification
- Requirements: 7/7 passed
- Scenarios: 10/10 passed
- Tasks: 17/17 complete (including 5.5 archive)
- Critical findings: 0
- Native status: apply and verify complete; archive ready

## Scope and Isolation

The Supabase PostgreSQL deployment capability is archived. The change declares one new capability: `supabase-postgres-deployment`, covering:

- Hosted database provisioning (Supabase Free, shared by Preview and Production)
- Vercel Node.js 24.x configuration and `package.json` `engines.node` declaration
- Secret custody via Vercel-managed runtime secrets (no values persisted)
- Human-only migration checkpoint using private session-mode connection
- Deterministic local failure harness proving acceptance/smoke halt on migration failure
- Fresh-session Preview smoke tests with disposable data (registration → login → dashboard → exercises → workouts → logout)
- Historical PR #1 assessment reconciliation preserving zero agent mutation

No product code, migrations, Prisma schema, seed behavior, build-migration behavior, `.gitignore`, or secret values were modified. PR #1 was assessed read-only and remains merged as an accepted historical fact outside this change.

## Accepted Findings

1. **Pre-existing React Hooks warning**: One pre-existing warning in `LoginForm.tsx` detected during `pnpm lint` and `pnpm build`; both commands exit 0. Out of scope.
2. **Build diagnostics**: `DYNAMIC_SERVER_USAGE` diagnostics during prerendering of authenticated dynamic routes; build completes successfully. Expected behavior.
3. **No formal test runner**: The project has no configured test/coverage runner. Migration-failure scenario covered by mandatory deterministic runtime harness.

All warnings are non-critical; they do not block archive.

## Specs and Mechanical Readback

### Spec Sync

- Delta spec: `openspec/changes/supabase-postgres-deployment/specs/supabase-postgres-deployment/spec.md` (full spec for new capability)
- Main spec: `openspec/specs/supabase-postgres-deployment/spec.md`
- Action: Copied (new capability; no main spec existed)
- Copy readback (`diff -r`): **empty output** (no differences)

### Archive Move

- Source: `openspec/changes/supabase-postgres-deployment/` (pre-move snapshot)
- Destination: `openspec/changes/archive/2026-08-12-supabase-postgres-deployment/`
- Move method: `git mv`
- Move readback (`diff -r`): **empty output** (no differences)
- Archive contents verified:
  - ✅ proposal.md
  - ✅ specs/supabase-postgres-deployment/spec.md
  - ✅ design.md
  - ✅ tasks.md (task 5.5 checked off)
  - ✅ verify-report.md
  - ✅ evidence.md
  - ✅ exploration.md

All artifacts verified present and byte-identical to pre-move snapshot.

## Verification Summary

Per `verify-report.md` (commit `4397bf0`):

- **Verdict**: PASS
- **Requirements**: 7/7 compliant
- **Scenarios**: 10/10 compliant
- **Blockers**: 0
- **Critical findings**: 0
- **Evidence revision**: sha256:33f09b10a3a93c0f41e6dfd3aa5dd9f16e84499dbcd30823ca4ae97e0c2bffd3

Verification evidence included:
- Lint: `pnpm lint` exit 0 (with pre-existing warning)
- TypeScript: `pnpm exec tsc --noEmit` exit 0
- Production build: `pnpm build` exit 0 (no migration/seed)
- Harness: `pnpm exec ts-node scripts/validate-migration-failure-guardrails.ts` exit 0 (simulated failure halts acceptance/smoke)

All 7 requirements and all 10 scenarios are fully compliant. The two former failures (from an earlier stale report) were closed by:
1. Node.js 24.x engine declaration in `package.json`
2. Deterministic zero-I/O local failure harness proving fail-closed behavior
3. Documentation-only reconciliation of accepted historical PR #1 merged state

## Key Design Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Transaction pooling at runtime; private session migration | Supabase best practice for serverless + human control of migrations | ✅ Implemented & verified |
| Human-only migration (no build automation) | Prevents uncontrolled shared-database mutations; creates hard failure checkpoint | ✅ Implemented & verified |
| Deterministic local failure harness | Proves acceptance/smoke halt without database/network access; no retry/seed/rollback | ✅ Implemented & verified |
| Node.js 24.x declaration in engines | Supabase runtime requirement; Vercel compliance | ✅ Implemented & verified |
| Historical PR #1 reconciliation | Preserves zero agent mutation during original assessment; accepts later merge as historical fact | ✅ Implemented & verified |
| Shared database with disposable Preview data | Cost-effective; disposable records protect production integrity | ✅ Design decision (human-executed) |

## Task Summary

All 17 tasks complete:

**Phase 1: Guardrails and Evidence** (3 tasks)
- [x] 1.1–1.3 Baselines, RED tests, and sanitized evidence checklist

**Phase 2: Repository and Human Checkpoints** (4 tasks)
- [x] 2.1–2.4 Node declaration, protected-path checks, Supabase provision, human migration

**Phase 3: Preview and PR Assessment** (3 tasks)
- [x] 3.1–3.3 Fresh smoke sequence, sanitized record, read-only PR #1 assessment

**Phase 4: Acceptance and Rollback** (2 tasks)
- [x] 4.1–4.2 Scope audit finalization, rollback planning

**Phase 5: Corrective Delivery** (5 tasks)
- [x] 5.1 Node engine add to package.json
- [x] 5.2 Deterministic migration-failure harness
- [x] 5.3 Historical documentation reconciliation
- [x] 5.4 Corrective verification (PASS)
- [x] 5.5 Archive (this task)

## Artifact Integrity

All original artifacts preserved in the archive:

| Artifact | Size | Format | Status |
|----------|------|--------|--------|
| proposal.md | ~2.1 KB | Markdown | ✅ Preserved |
| spec.md (specs/) | ~3.5 KB | Markdown | ✅ Preserved & synced to main specs |
| design.md | ~2.8 KB | Markdown | ✅ Preserved |
| tasks.md | ~3.2 KB | Markdown | ✅ Preserved & task 5.5 checked off |
| verify-report.md | ~7.1 KB | YAML + Markdown | ✅ Preserved |
| evidence.md | ~2.0 KB | Markdown | ✅ Preserved |
| exploration.md | ~1.5 KB | Markdown | ✅ Preserved |

No file truncation or modification occurred during archival. All readback diffs are empty.

## Final Checklist

- [x] Task Completion Gate: All tasks checked; 5.5 now complete
- [x] Native Review Receipt Gate: Not applicable (no review conducted; ordinary repository policy)
- [x] Spec Sync: Delta spec copied to main specs with empty diff verification
- [x] Archive Move: Change folder moved to archive with empty diff verification
- [x] Artifact Verification: All files present; byte-identical to pre-move snapshot
- [x] Engagement: All checklist items from verify-report met
- [x] No stale checkboxes: All tasks accurately reflect completion state
- [x] No CRITICAL issues: Zero critical findings in verify-report
- [x] Protected paths untouched: No schema, migration, seed, build-migration, .gitignore, or secret value change

## Archival Complete

The `supabase-postgres-deployment` change has been successfully archived. The delta specification is now part of the main spec collection at `openspec/specs/supabase-postgres-deployment/spec.md`. All SDD phases (proposal → spec → design → tasks → apply → verify → archive) are complete.

Ready for the next change.
