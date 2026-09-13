# Archive Report: exercise-soft-delete

**Archived**: 2026-09-13
**Mode**: hybrid (Engram + OpenSpec)
**Change**: exercise-soft-delete

## Summary

Soft-delete lifecycle for exercises: `isActive` schema flag, active-only read paths, a toggle server action, and a deactivate UI button. Exercises are retired from lists and pickers while preserving `Set` history. All 25 tasks completed, all gates green.

## Artifacts Moved

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ archived |
| `specs/exercise-soft-delete/spec.md` | ✅ archived (also promoted to main spec) |
| `design.md` | ✅ archived |
| `tasks.md` | ✅ archived (25/25 tasks complete) |
| `verify-report.md` | ✅ archived |
| `exploration.md` | ✅ archived |

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| exercise-soft-delete | Created | 7 requirements added (Active Flag on Exercise Schema, Active-Only Read Paths, Toggle Action Contract, Set History Preservation, Deactivate Control in ExerciseSection, Name Uniqueness Unaffected) with 16 scenarios total |

**Main spec promoted to**: `openspec/specs/exercise-soft-delete/spec.md`

## Verification Verdict

**Final verdict**: PASS WITH WARNINGS (16/16 scenarios verified)

- 9 runtime unit tests (mocked action tests + schema tests)
- 5 migration/build gates
- 2 UI typecheck-only at report time

### User Manual Smoke (performed AFTER verify report, by maintainer on http://localhost:3001)

| # | Case | Result |
|---|------|--------|
| 1 | Deactivate removes the card after refresh | ✅ PASS |
| 2 | Deactivated exercise absent from `/workouts/create` picker | ✅ PASS |
| 3 | Logged-out access redirects to login with no breakage | ✅ PASS |
| 4 | Set history intact on workout detail | ✅ PASS |

This closes the 2 UI scenarios' evidence gap. The verify-report's "typecheck-only" warnings for UI scenarios are superseded by direct manual verification.

## Gates (Final)

| Gate | Result |
|------|--------|
| `pnpm test` (84/84) | ✅ green |
| `pnpm exec tsc --noEmit` | ✅ green |
| `pnpm lint` | ✅ green |
| `pnpm run format:check` | ✅ green |
| `pnpm exec prisma validate` | ✅ green |
| `pnpm build` | ✅ green |

## Commits

- `387e968` — 381 insertions, all 25 tasks implemented
- Migration `20260913193952_exercise_is_active` applied to local DB; all pre-existing rows active

## Residual Risks

1. **TOCTOU on name uniqueness** — Acceptable. The `name @unique` constraint prevents duplicate names at the DB level; deactivation does not free the constraint. Reactivation is the supported path.
2. **Name-unique interaction** — Specified and documented. Creating an exercise whose name is held by an inactive exercise fails; reactivation restores it.
3. **Update-URL edge** — Accepted. Deep-linking to a deactivated exercise's edit URL would fail gracefully (read paths filter inactive rows).
4. **Node 22 vs 24 environment noise** — Observed during verification. Not a code issue; local env version difference only.

## Follow-ups

- Reactivation UI is deferred (server-side reactivation works, UI button not yet added). Track in Notion backlog as a future change.
- No other follow-ups required. The change is complete.

## Engram Observations

| Artifact | Engram Topic Key |
|----------|-----------------|
| archive-report | `sdd/exercise-soft-delete/archive-report` |
