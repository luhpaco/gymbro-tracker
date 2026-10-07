# Archive Report: Edit and Delete Saved Workouts

## Summary

**Change**: `workout-edit-delete` (Notion F0.2)
**Archived to**: `openspec/changes/archive/2026-10-05-workout-edit-delete/`
**Date**: 2026-10-07
**Final revision**: `39cc9c4155821a1607b2393e4104b6889109a329` (`origin/master`, includes post-merge CodeRabbit fix)

## What Was Implemented

Four capabilities delivering post-save corrections for saved workouts:

| Capability | Requirements | Scenarios | Status |
|---|---:|---:|---|
| `saved-workout-management` | 4 | 12 | Created (new durable spec) |
| `saved-workout-set-management` | 5 | 18 | Created (new durable spec) |
| `workout-set-ordering` | 6 (4 modified, 2 unchanged) | 24 (was 16; +8) | Updated (MODIFIED requirements) |
| `workout-set-validation` | 8 (3 modified, 3 unchanged) | 33 (was 24; +9) | Updated (MODIFIED requirements) |
| **Total** | **23** | **87** | **PASS** |

The two new specs (`saved-workout-management`, `saved-workout-set-management`) introduce owner-scoped metadata edits, confirmed whole-workout deletion, validated set/exercise additions, and last-set/last-exercise refusal codes. The two modified specs (`workout-set-ordering`, `workout-set-validation`) extend existing post-creation coverage to post-save additions and removals.

## Delivery

- **Strategy**: feature-branch-chain (`ask-on-risk`).
- **Slice sizes (all `size:exception` approved, precedent F0.1 slice 2a)**:
  - PR #48 — `feat/wed-s1-metadata`: +1186 authored lines (metadata edit + immutable tag)
  - PR #47 — `feat/wed-s2-data`: +1699 authored lines (transactional data layer + 4 server actions)
  - PR #50 — `feat/wed-s3a-controls`: +757/+2 authored lines (`WorkoutDetailControls` UI + pure logic)
  - PR #49 — `feat/wed-s3b-page`: +539/+131 authored lines (`WorkoutDeleteConfirmation` sheet + page wiring)
  - PR #51 — `feat/wed-post-stack`: +1108/+14 authored lines (concurrency harness, 4.4 retry jitter, tasks.md close)
- **Tracker**: `luhpaco/feat-workout-edit-delete` consolidated all 5 slices via `git merge --no-ff feat/wed-post-stack`, which auto-merged the four intermediate PRs (#48, #47, #50, #49, #51) on push as GitHub detected their commits were now reachable.
- **Final integration**: PR #52 (master ← tracker) merged by luhpaco at `2026-10-07T03:31:28Z` (merge commit `a63e505`).
- **Post-merge fix**: commit `39cc9c4` applied `validateAddSetDraft` reuse of shared `setSchema` (CodeRabbit nitpick, behavior-preserving).
- **CI `verify` on PR #52**: passed in 52s.

## Verification Results

All six local gates passed on the final slice commit `ac145f2`, and again on the post-merge fix `39cc9c4`:

| Gate | `ac145f2` | `39cc9c4` |
|---|---|---|
| `pnpm test` | 31 files / 409 tests pass | 31 files / 409 tests pass |
| `pnpm build` | exit 0 | exit 0 |
| `pnpm lint` | clean | clean |
| `pnpm run format:check` | clean | clean |
| `pnpm exec tsc --noEmit` | exit 0 | exit 0 |
| `pnpm exec prisma validate` | schema valid | schema valid |

**Real-PostgreSQL concurrency (task 4.1)** in periwinkle worktree (port 5434, disposable fixtures): 5/5 scenarios PASS — atomic rollback on parent-delete failure, restrictive FK preserved, race-loss on `last_set`/`last_exercise`, distinct appended orders on concurrent additions.

**Manual responsive/keyboard QA (task 4.2)** with agent-browser on worktree dev server (port 3001): 19/19 checks PASS — five dismissal paths for confirmation sheet produce zero writes, explicit confirmation deletes exactly once and navigates to `/workouts`, pending state cleared on cancel/item switch/navigation, `last_set` and `last_exercise` explanations surfaced, touch targets 44x44, focus visible and trapped, no overflow at 1280×577 or 390×844, safe-area inset respected, stale detail URL no longer resolves.

**Rollout risks (task 4.3) — DEFERRED, not verified**: no target environment deployed yet. Two risks remain open before delete is enabled anywhere real:
1. No recoverable backup verified. `Set_workoutId_fkey` is `ON DELETE RESTRICT`; the deleted row cannot be restored by code.
2. DB commit + `revalidatePath` are not cross-system atomic; the action contract cannot report them separately.

**4.4 follow-up**: bounded 5–25 ms jitter between P2034 retries applied to `src/data/workout-mutations.ts`. Fail-closed `error` on genuine exhaustion preserved. Verified via deterministic unit tests + unchanged real-Postgres harness.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `saved-workout-management` | Created | 4 requirements, 12 scenarios |
| `saved-workout-set-management` | Created | 5 requirements, 18 scenarios |
| `workout-set-ordering` | Updated | 4 MODIFIED requirements, +8 scenarios (added post-save coverage to order, read-back, deletion gaps, warmup) |
| `workout-set-validation` | Updated | 3 MODIFIED requirements, +9 scenarios (extended shared-set-schema and no-upper-bound to post-save; added last-set/last-exercise refusal at validation tier) |

## Archive Contents

- `proposal.md`: present
- `design.md`: present
- `exploration.md`: present
- `specs/` (4 delta specs): present
- `tasks.md`: present, 18/18 Phase 1–5 tasks marked `[x]` (Phase 5 archive was manual, see `archive-report.md` itself)
- `archive-report.md`: present (this file)
- `verify-report.md`: present

## Source of Truth Updated

The following durable specs now reflect the new behavior:
- `openspec/specs/saved-workout-management/spec.md` (created)
- `openspec/specs/saved-workout-set-management/spec.md` (created)
- `openspec/specs/workout-set-ordering/spec.md` (modified)
- `openspec/specs/workout-set-validation/spec.md` (modified)

## Follow-Ups (Out of Scope)

Recorded as Notion backlog items (not blocking archive):

1. **Backup recovery verification** (task 4.3 risk): required before delete is enabled anywhere real. Documented in `openspec/changes/archive/2026-10-05-workout-edit-delete/tasks.md` (Phase 4.3).
2. **`revalidatePath` cross-system atomicity** (task 4.3 risk): committed transaction and `revalidatePath` failure are not atomic; the action contract cannot report them separately. Required resolution before rollout.
3. **Dialog close target 16x16**: the composed `WorkoutDeleteConfirmation` sheet's close icon is 16x16 because the shared `src/components/ui/dialog.tsx` primitive (explicitly out of scope) sets no minimum size. Affects every dialog in the app, not just this change. Tracked separately.
4. **`updateSet` contract**: its codeless `{ ok: boolean }` was deliberately preserved by F0.2's `workout-tag-uniqueness` extension. Still a follow-up to align to the coded-union pattern used by the new actions.

## Tasks

- **Completed**: 18/18 (Phase 1, Phase 2, Phase 3, Phase 4, Phase 5.1)
- **Unfinished**: none (Phase 5 archive step is manual and is the action this report records)

## Engram Traceability

- Session summary: `obs-3724` (close-out session summary)
- PR-stacked-delivery observation: `obs-3723` (5 PRs opened, gates green)
- Drift-detection observation: `obs-3720` (drift memoria↔repo, the 16-commit branch was on tracker, not yet delivered)
- Chain-collapse pattern: `obs-4775` (collapse feature branch chain into tracker for unified CI + CodeRabbit review)
- Prisma-generate required after fresh checkout: `obs-3754`
- Worktree-cleanup needs active podman user socket: `obs-3757`
- Soft-TDD note (already in F0.1 archive): pure-logic unit scope only; server actions and data layer tested with mocked `@/auth`, `@/lib/prisma`, `next/cache`; no DOM/component/E2E claims for the new UI components.