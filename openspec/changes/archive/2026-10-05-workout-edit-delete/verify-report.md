# Verify Report: Edit and Delete Saved Workouts

## Scope

- **Change**: `workout-edit-delete` (Notion F0.2)
- **Revision inspected**: `39cc9c4155821a1607b2393e4104b6889109a329` (`origin/master`, includes the post-merge CodeRabbit fix on top of merge commit `a63e505`)
- **Mode**: Strict TDD (`pnpm test`, Vitest) for logic; manual responsive/keyboard QA for the UI components
- **Artifacts inspected**: proposal, design, exploration, tasks, four delta specs, three implementation files at the data layer (`workout-mutations.ts`), four server actions and their mock-based tests, two new UI components plus their pure-logic helpers and tests, the concurrency harness, the deleted archive-report.md and tasks.md close-out evidence, and the post-merge fix diff
- **Historical delivery evidence supplied to verification**: five-PR feature-branch chain #48 → #47 → #50 → #49 → #51 → #52 merged on GitHub; CI `verify` run `37566382451` (52s); manual browser smokes for task 4.2; task 4.1 real-PostgreSQL concurrency harness run on periwinkle; task 4.3 rollout-risks deferral note; post-merge CodeRabbit fix on commit `39cc9c4`

## Executive Summary

**PASS WITH ONE ROLLOUT-DEFERRAL.** The merged implementation satisfies the 23 requirements and covers all 87 scenarios across the four delta specs through current automated tests, static inspection, manual UI QA, and the supplied real-PostgreSQL concurrency and browser-smoke evidence. All six requested local gates passed on the inspected revision. No CRITICAL implementation, specification, contract, or assertion-quality finding was found.

The only open item is ROLLOUT: task 4.3 (backup recovery verification and `revalidatePath` atomicity) is DEFERRED, not RESOLVED. The action contract is sound; what is unverified is the operational preconditions for enabling irreversible deletion. Both points are documented in the change folder.

## Observed Progress

- `tasks.md`: **18/18** Phase tasks marked `[x]` across Phases 1–5. Phase 5's archive step is manual and is recorded in `archive-report.md` itself.
- Git: `HEAD` equals `origin/master` at `39cc9c4`; the merge commit `a63e505` plus the post-merge CodeRabbit fix `39cc9c4` are both in `origin/master`.
- Before this report was written, the only repository modifications were the four spec-sync changes and the move of the change folder to `openspec/changes/archive/2026-10-05-workout-edit-delete/`. Schema and migrations remain unchanged.
- Delivery guard: each of the five stacked PRs requested an approved `size:exception` (1186 / 1699 / 757 / 539 / 1108 authored lines). All were explicitly granted; no current `size:exception` label exists in the repository (per F0.1 follow-up #5).
- The two intermediate worktrees (`periwinkle`, `sanddab`) used during delivery were torn down via `scripts/worktree-cleanup.sh` after the work merged.

## Practical Checks Executed

| Command | Exit | Result |
|---|---:|---|
| `pnpm test` | 0 | 31 files, **409/409 tests passed** |
| Focused action tests (`update-workout`, `add-sets`, `delete-set`, `remove-workout-exercise`, `delete-workout`) | 0 | 5 files, **122/122 tests passed** |
| Focused UI logic tests (`workout-detail-controls.logic`, `workout-delete-confirmation.logic`) | 0 | 2 files, **27/27 tests passed** (covers the new `validateAddSetDraft` use of `setSchema`) |
| `pnpm build` | 0 | Prisma client generated; Next.js compiled; all routes generated |
| `pnpm lint` | 0 | No ESLint warnings or errors |
| `pnpm run format:check` | 0 | All matched files use Prettier style |
| `pnpm exec tsc --noEmit` | 0 | No type errors |
| `pnpm exec prisma validate` | 0 | Prisma schema valid |

Non-blocking environment output:

- `pnpm` reported Node `22.22.2` while `package.json` requests `24.x`.
- `next lint` reported its existing Next.js 16 deprecation notice.
- `prisma generate` regenerates the client from the schema after a fresh `pnpm install`; without it, `tsc --noEmit` reports stale errors that look like missing schema fields. Recorded in Engram as `obs-3754`.

Coverage analysis was skipped because `openspec/config.yaml` records `testing.coverage.available: false`.

## Spec Compliance Summary

| Capability | Requirements | Scenarios | Evidence summary | Result |
|---|---:|---:|---|---|
| `saved-workout-management` | 4/4 | 12/12 | Owner-scoped metadata write (`workout-mutations.ts:118-159`), post-save schemas (`workout.ts`), Zod-validated action (`update-workout.ts`), atomic whole-workout deletion via app-level transaction (`workout-mutations.ts:174-237`), bottom-sheet confirmation controlled by 5 dismissal paths, revalidation restricted to successful mutations, mock-based action tests covering owner isolation | PASS |
| `saved-workout-set-management` | 5/5 | 18/18 | Serializable set-list mutation helpers with coded refusals (`workout-mutations.ts:241-380`), four server actions (`add-sets`, `delete-set`, `remove-workout-exercise`, `delete-workout`) all Zod-validated, `last_set`/`last_exercise` distinct codes, bounded retry with 5–25 ms jitter, two-tap inline confirmation in `WorkoutDetailControls`, mock-based action tests covering all four code paths | PASS |
| `workout-set-ordering` | 6/6 | 24/24 | Server-assigned order at submit time + post-save addition via `max + 1 + index` (`workout-mutations.ts:357-372`), gap-tolerant read-back using `(order, createdAt, id)` total sort (`workout-sets.ts:22-62`), non-unique `(workoutId, order)` index unchanged, `setSchema.shape.isWarmup` default `false` applied to post-save additions, mock-based action tests + supplied real-PostgreSQL harness | PASS |
| `workout-set-validation` | 8/8 | 33/33 | Single `setSchema` source-of-truth reused by all entry points including the new post-save mutations (`workout-set.ts`), pre-write Zod validation in all four new actions, no upper bound on sets per exercise after creation, last-set refusal prevents empty exercise, last-exercise refusal prevents empty workout, mock-based action tests + the post-merge CodeRabbit fix in `validateAddSetDraft` reuses `setSchema` to eliminate client-side duplication | PASS |
| **Total** | **23/23** | **87/87** | Automated, static, manual UI, real-PostgreSQL concurrency, browser smoke, and post-merge review combined | **PASS** |

## Non-Vitest Scenarios

### Real-PostgreSQL concurrency (task 4.1)

`scripts/validate-workout-concurrency.ts` ran against the isolated worktree database (port 5434) with disposable owned fixtures:

- Atomic rollback: when the parent workout delete fails after the dependent workout delete succeeds, both rolls back; the FK remains enforced.
- Race-loss on `last_set`: two concurrent deletes of the second set of an exercise with two sets; one succeeds, the other retries into `last_set`.
- Race-loss on `last_exercise`: two concurrent removes of the second exercise of a workout with two exercises; one succeeds, the other retries into `last_exercise`.
- Concurrent additions: distinct appended workout-wide order values, no collisions.
- Query persisted rows after each operation and recorded outcomes.

### Manual UI QA (task 4.2)

With agent-browser 0.37.1 against the worktree dev server (port 3001) and disposable fixtures:

- Every dismissal path (open, overlay, Escape, close icon, Cancel) produced zero writes.
- Explicit confirmation deleted exactly once and navigated to `/workouts`.
- First inline set/exercise tap produced zero writes.
- Cancel / item-switch / navigation cleared the pending state.
- `last_set` and `last_exercise` refusal messages explained the boundary.
- Touch targets measured 44×44.
- Focus was visible and trapped in the sheet.
- No horizontal overflow at 1280×577 or 390×844.
- Sheet anchored to bottom with `env(safe-area-inset-bottom)` padding.
- Stale detail URL no longer resolved after delete.

### Post-merge CodeRabbit review

On the full diff (5159 authored lines, 32 files), CodeRabbit reported Merge Risk: Low. One substantive nitpick — `validateAddSetDraft` in `workout-detail-controls.logic.ts` had duplicated weight/reps rules that already existed in `setSchema` — was applied as commit `39cc9c4` with all six local gates green and behavior-preserving (27/27 logic tests pass).

### Generated SQL inspection

- Schema and migrations are unchanged. No new migration was generated.
- `Set_workoutId_fkey` remains `ON DELETE RESTRICT`.
- `Set_workoutId_order_idx` remains a non-unique index.

## Design Coherence

- `Set.workoutId` and `Set.exerciseId` remain the only authoritative relationships for set reads, mutations, and deletions.
- All four new actions read `Workout` and `Exercise` inside the same transaction that writes to `Set`, so membership/owner checks see the same data the write touches.
- `revalidatePath` is called only after the transaction commits, only on success, and always for both the affected detail route and `/workouts`.
- The retry loop only restarts the entire transaction on P2034 (serialization failure); known refusals (`unauthorized`, `invalid_input`, `not_found`, `last_set`, `last_exercise`) short-circuit and never retry. Jitter runs only between attempts, never before the first or after the final.

## Non-blocking Caveats

- The `updateSet` action's codeless result contract was deliberately preserved. Aligning it to the coded-union pattern used by the new actions remains an out-of-scope follow-up.
- The shared `src/components/ui/dialog.tsx` primitive's close icon is 16×16. This change composed a sheet from that primitive and inherited the issue. The primitive itself was explicitly out of scope; the issue affects every dialog in the app and is tracked separately.
- The deletion code path is fully implemented and tested at the contract level, but no real environment has been deployed yet (task 4.3). Two preconditions — verified backup recovery and verified cache-invalidation atomicity — are documented and required before enabling irreversible deletion in any real environment.