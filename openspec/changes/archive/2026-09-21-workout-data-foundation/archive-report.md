# Archive Report: Workout Data Foundation

## Summary

**Change**: `workout-data-foundation` (Notion F0.1)
**Archived to**: `openspec/changes/archive/2026-09-21-workout-data-foundation/`
**Date**: 2026-09-21
**Final revision**: `e6665756654a86df3be842c907104582cb0d0dd4` (merged to `master` on 2026-09-22)

## What Was Implemented

Five capabilities delivering the workout data foundation:

| Capability | Requirements | Scenarios | Status |
|---|---:|---:|---|
| `workout-set-ordering` | 6 | 18 | Created (new durable spec) |
| `workout-set-validation` | 8 | 28 | Created (new durable spec) |
| `workout-tag-uniqueness` | 6 | 19 | Created (new durable spec) |
| `workout-session-timestamps` | 5 | 12 | Created (new durable spec) |
| `workout-creation-form` | 7 (4 existing + 3 added) | 15 | Updated (MODIFIED + ADDED merged) |
| **Total** | **29** | **89** | **PASS** |

## Delivery

- **Strategy**: feature-branch-chain (ask-on-risk, user-approved `size:exception` for PR 1)
- **PR 1** (#43): 588 authored lines (size:exception approved), schema foundation + write path
- **PR 2** (#44): 383 authored lines, validation hardening + reads + UI
- **PR 3** (#45): 335 authored lines, tag collision retry
- **Tracker** (#42): merged to `master` after all child PRs integrated
- **CI `verify`**: passed (run `35678441438`, 1m11s)

## Verification Results

All six local gates passed on `e666575`:

| Gate | Result |
|---|---|
| `pnpm test` | 256/256 (23 files) |
| `pnpm build` | exit 0 |
| `pnpm lint` | clean |
| `pnpm run format:check` | clean |
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm exec prisma validate` | valid |

**Browser smokes** (tasks 1.18, 2.10, 3.9): PASS — stored order `0..n-1`, per-group "Serie N", uncapped add-set through 10 sets, weight `0` persists, negative-weight and fractional-reps messages, same-day saves taking `-2`/`-3` tags, second user's base tag, clean dev-server log.

**Strict-TDD provenance warning**: Engram apply-progress `#3241` records RED/GREEN evidence for all five work units, but PR1/PR2 rows omit explicit Safety Net and Triangulate columns. Current GREEN behavior and assertion quality were independently verified; omitted historical metadata cannot be reconstructed. This is a process-evidence limitation, not an implementation defect.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `workout-set-ordering` | Created | 6 requirements, 18 scenarios |
| `workout-set-validation` | Created | 8 requirements, 28 scenarios |
| `workout-tag-uniqueness` | Created | 6 requirements, 19 scenarios |
| `workout-session-timestamps` | Created | 5 requirements, 12 scenarios |
| `workout-creation-form` | Updated | 1 MODIFIED (Single validated submission), 3 ADDED (No set cap, Bodyweight sets, Failure code handling) |

## Archive Contents

- `proposal.md`: present
- `specs/` (5 delta specs): present
- `design.md`: present
- `tasks.md`: present, 47/47 tasks complete (4.2 and 4.3 marked complete per final-state facts)
- `verify-report.md`: present
- `exploration.md`: present

## Source of Truth Updated

The following durable specs now reflect the new behavior:
- `openspec/specs/workout-set-ordering/spec.md`
- `openspec/specs/workout-set-validation/spec.md`
- `openspec/specs/workout-tag-uniqueness/spec.md`
- `openspec/specs/workout-session-timestamps/spec.md`
- `openspec/specs/workout-creation-form/spec.md` (composed via `gentle-ai sdd-archive-compose`)

## Follow-Ups (Out of Scope)

Recorded as Notion backlog items (not blocking archive):

1. **Unify uniqueness violation matchers**: `isCanonicalUniquenessViolation` (exercises) and `isWorkoutTagCollision` (workouts) share ~15 lines of deliberate duplication. Refactor into one `isUniqueViolationOn`.
2. **`updateSet` does not bump `Workout.updatedAt`**: the `@updatedAt` annotation on `Workout.updatedAt` only fires on direct `workout.update()` calls, not through nested `set.update()`.
3. **F0.2 (`workout-edit-delete`) constraints**: `Workout.tag` must stay immutable after creation (never recompute on rename); F0.2 should route by `id` instead of `tag`.
4. **Pre-existing UX issues**: submitting a set with `reps` 0 gives no visible feedback; blank weight shows the inline editor's own "Valor inválido" before the schema message; editing a set's weight in the detail fires two POSTs (uninvestigated).
5. **No `size:exception` label**: the repository has only `status:approved` and `type:*` labels; PR 1 requested the exception in its body only.

## Tasks

- **Completed**: 47/47
- **Unfinished**: none

## Engram Traceability

- Archive report: `sdd/workout-data-foundation/archive-report` (observation #3286)
- Verify report: `sdd/workout-data-foundation/verify-report` (observation #3285)
- Apply progress: `sdd/workout-data-foundation/apply-progress` (observation #3241)
