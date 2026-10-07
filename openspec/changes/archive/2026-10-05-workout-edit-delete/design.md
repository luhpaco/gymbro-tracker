# Design: Edit and Delete Saved Workouts

## Technical Approach

Extend the existing `/workouts/[slug]` detail page with post-save controls. New server actions authenticate, validate with Zod, delegate owner-scoped reads and writes to `src/data/`, and revalidate the immutable-tag detail route and `/workouts` only after a committed mutation. Use PostgreSQL serializable transactions for set-list mutations so concurrent removals cannot turn a nonempty workout or recorded exercise into an empty one. Keep creation, `updateSet`, the Prisma schema, and migrations unchanged.

The binding decisions are proposal decisions 1–6. The relevant contracts are `saved-workout-management`, `saved-workout-set-management`, and the `workout-set-ordering`/`workout-set-validation` deltas.

## Architecture Decisions

### Decision: Keep the stored tag and the creation contract unchanged

**Choice**: Edit only `Workout.name` and `Workout.date`; use the owner-scoped stored `tag` from the lookup to revalidate the original URL. Define post-save input schemas in `src/lib/schemas/workout.ts` using `AddWorkoutFormSchema.shape.nameWorkout`, `.dateWorkout`, and the existing `setsSchema`. Do not change `AddWorkoutFormSchema`, its tag generation, or `src/lib/schemas/workout-set.ts`.

**Alternatives considered**: Recompute the tag on edit; duplicate set validation; reuse the entire create schema for edits.

**Rationale**: The tag is immutable by `workout-tag-uniqueness`, and the create form requires fields irrelevant to edits. Reusing the existing field schemas keeps the rules identical without changing creation's minimum-exercise/minimum-set and tag contracts. Validate identifier fields as UUID strings (the schema generates UUID IDs); accepting extra client `order` fields must never persist them.

### Decision: Owner-scoped data-layer mutations behind coded server actions

**Choice**: Introduce one action per operation in `src/actions/workout/`, plus `src/data/workout-mutations.ts` for all new Prisma reads/writes. Every action follows the `setExerciseActiveState` sequence: `auth()` and session check → `safeParse` → owner-scoped target lookup → mutation → success-only `revalidatePath`. The data-layer transaction owns the lookup for any operation whose correctness depends on the current set list. Result codes are exactly `unauthorized | invalid_input | not_found | last_set | last_exercise | error`, with last-item codes returned only for their applicable operation; successful results are `{ ok: true }`.

**Alternatives considered**: Prisma calls in client components; querying a foreign target first and checking its owner afterwards; retrofitting `updateSet`.

**Rationale**: Existing detail reads use `userId_tag`; `updateSet` uses an owner-scoped set lookup; new actions should not expose whether an ID belongs to someone else. A missing workout, foreign workout, missing set, set from a different workout, or exercise never recorded in that owned workout all return `not_found`, without an unscoped lookup or write. `updateSet` remains unchanged, including its codeless result and existing single-route revalidation.

For workout-ID operations, select `{ id, tag }` from `workout.findFirst({ where: { id: workoutId, userId } })`; check item membership by *both* `workoutId` and `setId`/`exerciseId` after that lookup. Restrict every write with the same IDs, and check `deleteMany`/`updateMany` affected-row counts; a stale or concurrent disappearance becomes `not_found` after rollback, not a success. Errors other than a recognized stale target or last-item refusal map to `error`. Revalidate only after the transaction resolves and the action has a successful result.

### Decision: Explicit, atomic whole-workout deletion

**Choice**: `deleteOwnedWorkout(userId: string, workoutId: string)` lives in `src/data/workout-mutations.ts`. Within a single interactive `prisma.$transaction`, look up the owned workout and its tag, `tx.set.deleteMany({ where: { workoutId } })`, then `tx.workout.deleteMany({ where: { id: workoutId, userId } })`; require the parent count to equal one. On a failed write/count, roll back all deletions. Return the original tag for post-commit cache invalidation. The action never executes the delete before explicit UI confirmation.

**Alternatives considered**: Bare `workout.delete`, schema-level `onDelete: Cascade`, or independent set and workout deletes outside a transaction.

**Rationale**: The existing `Set_workoutId_fkey` is `ON DELETE RESTRICT`; an unguarded parent delete fails. A single transaction prevents committed partial cleanup, and the restrictive FK remains a last-resort defense for other delete paths. **No migration is introduced; `prisma/schema.prisma` and the FK remain unchanged.** Hard deletion cannot be undone by reverting code; confirm a recoverable backup before enabling it.

### Decision: Serializable guard for final-item refusals and append ordering

**Choice**: Run **all new set-list operations** (add sets, delete set, remove exercise, whole-workout delete) in interactive `prisma.$transaction` with `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. Put owner lookup, membership lookup, guard reads, and writes *inside the same transaction*. On Prisma `P2034` serialization/write conflict, retry the **entire transaction** a small fixed number of times (e.g. three total attempts); re-read membership and counts on every attempt. On exhaustion, return `error` without revalidating. Never retry a known refusal or `not_found`.

- Delete one set: locate `{ id: setId, workoutId }`, count rows for that `workoutId` **and that set's `exerciseId`**, return `last_set` if count is one; otherwise conditionally delete only the located set and require affected-row count one.
- Remove an exercise: establish an existing set with `{ workoutId, exerciseId }`; count sets for **other** exercises in that workout, return `last_exercise` if none; otherwise delete only `{ workoutId, exerciseId }`. This does not delete the global `Exercise` row or its sets in other workouts.
- Add sets: verify `{ workoutId, exerciseId }` already has a set; do not filter on `Exercise.isActive`. Read the workout-wide `_max.order` in the same transaction and assign each submitted set `max + 1 + index` in input order. Construct persistence rows from parsed `reps`, `weight`, `isWarmup`, server `workoutId`/`exerciseId`, and server `order` only. Preserve surviving order values and gaps after deletion; never renumber.

**Alternatives considered**: Count before a normal READ COMMITTED delete; only disable removal buttons when one item is visible; enforce unique `(workoutId, order)`; row-count checks without a guard read.

**Rationale**: Two concurrent requests can each see two remaining sets/exercises and delete different ones under READ COMMITTED (write skew). PostgreSQL serializable isolation detects the predicate-read/write conflict and aborts one transaction; its retry then observes the remaining single item and returns `last_set`/`last_exercise`. The same retry prevents concurrent appends from both committing an order derived from a stale maximum, without adding a uniqueness constraint (duplicates remain allowed for legacy data). If the database cannot complete a serializable transaction within the bound, fail closed as `error`, preserving the invariant. A mock-only test cannot prove PostgreSQL's conflict detection; an isolated local-DB concurrency check is required before delivery.

### Decision: Separate destructive confirmation from server authorization

**Choice**: A new `WorkoutDeleteConfirmation` client component composes `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogClose` from `src/components/ui/dialog.tsx`. Match the mobile bottom-sheet positioning/safe-area padding in `src/components/navigation/AuthenticatedNavigationShell.tsx`; add a non-destructive Cancel and an explicit Delete button. `Dialog` is controlled; open, overlay click, Escape, close icon, and Cancel dismiss without calling the action. While delete is pending, disable repeat confirmation and dismissal; on success close and navigate to `/workouts`, on failure keep context and show the coded error. Leave `src/components/ui/dialog.tsx` unchanged.

For sets/exercises, keep a single pending `{ kind, id }` confirmation in a client detail-controls component. First tap reveals labeled inline Confirm/Cancel controls and performs no action; only Confirm invokes the scoped action. Switching item, Cancel, or navigating away cancels the pending state. Use `min-h-11 min-w-11` on icon controls and at least `min-h-11` on text controls, visible focus, labels that name the item, and bottom-reachable controls without horizontal overflow. Inline feedback explains `last_set` (each recorded exercise must retain a set) and `last_exercise` (the workout must retain an exercise; whole-workout deletion is separate), rather than silently disabling buttons. Follow the `ExerciseSection.tsx` toast and `router.refresh()` pattern after successful additions/removals/edits; on delete navigate away instead of refreshing the now-missing detail.

**Alternatives considered**: One-tap deletion; a global alert dialog for each row; hiding last-item buttons.

**Rationale**: The staggered UI is binding: whole-workout deletion is irreversible and requires an explicit sheet, while two-tap inline removal preserves the mobile flow. Server guards remain authoritative even when another tab changes the list between taps. The existing `DialogContent` supplies its own close icon and overlay, so compose rather than nest another dialog or fork the primitive.

## Data Flow

```text
RSC page (await params; auth; getWorkoutBySlug by owner + tag)
  └─ serializable props: workoutId, original tag, name, date ISO, grouped sets
       ├─ metadata form / add-set form / inline set & exercise confirmations
       └─ whole-workout bottom sheet
            └─ action: auth → Zod → src/data/workout-mutations.ts
                 └─ transaction: owner lookup → membership/guard → scoped write → commit
                      ├─ refusal/error: coded result, no cache invalidation
                      └─ success: revalidatePath(`/workouts/${storedTag}`)
                                  revalidatePath('/workouts') → refresh or navigate
```

Concurrent final-item sequence (both transactions read two items):

```text
T1: read 2 → delete A ────────── commit
T2: read 2 → delete B ────────── serialization conflict (P2034)
T2 retry: read 1 → last_set/last_exercise, no write or revalidation
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/schemas/workout.ts` | Modify | Add post-save input schemas derived from existing name/date/set schemas; leave `AddWorkoutFormSchema` untouched. |
| `src/data/workout-mutations.ts` | Create | Owner-scoped metadata update; serializable delete/add/remove helpers, count guards, bounded conflict retry. |
| `src/actions/workout/update-workout.ts` | Create | Metadata edit, immutable tag, coded result and dual revalidation. |
| `src/actions/workout/delete-workout.ts` | Create | Confirmed-operation endpoint backed by atomic data-layer deletion. |
| `src/actions/workout/add-sets.ts` | Create | Validate post-save sets and delegate server ordering/recorded-exercise check. |
| `src/actions/workout/delete-set.ts` | Create | Delete scoped set with final-set refusal. |
| `src/actions/workout/remove-workout-exercise.ts` | Create | Remove scoped exercise sets with final-exercise refusal. |
| `src/components/workout/WorkoutDeleteConfirmation.tsx` | Create | Radix bottom-sheet confirmation and pending/failure states. |
| `src/components/workout/WorkoutDetailControls.tsx` | Create | Metadata and add-set forms plus per-item two-tap confirmation/feedback around existing rows. |
| `src/components/workout/WorkoutDetailSets.tsx` | Modify | Retain existing `EditableStat` behavior and render set-level removal controls through detail controls. |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modify | Pass ID/tag/date and existing set `exerciseId` into client controls; render workout-level controls and sheet. Keep owner-scoped tag lookup and redirect behavior. |
| `src/data/workout-mutations.test.ts` | Create | Mock transaction logic for scoped writes, rollback/error mapping, retry/re-read and ordering. |
| `src/actions/workout/update-workout.test.ts` | Create | Action validation, ownership, immutable-tag edit, revalidation/error behavior. |
| `src/actions/workout/delete-workout.test.ts` | Create | Session/owner isolation, whole-delete success/failure and post-commit revalidation. |
| `src/actions/workout/add-sets.test.ts` | Create | Set rules, warmups, inactive recorded exercise, order, non-recorded refusal and cache behavior. |
| `src/actions/workout/delete-set.test.ts` | Create | Foreign/unrelated IDs, last-set refusal and success-only cache behavior. |
| `src/actions/workout/remove-workout-exercise.test.ts` | Create | Cross-workout isolation, last-exercise refusal and success-only cache behavior. |

No modification is planned to `src/actions/workout/update-set.ts`, `src/actions/workout/create-workout.ts`, `src/lib/schemas/workout-set.ts`, `src/lib/workout-sets.ts`, `src/actions/index.ts` (new UI imports actions directly), `src/components/ui/dialog.tsx`, existing list/detail read actions, `prisma/schema.prisma`, or migrations. Existing `SET_ORDER_BY` and `groupSetsByExercise` already enforce the required read order; the new UI uses each group's existing `sets[0].exerciseId`, not the display name, as mutation identity. No archived main spec is changed until archive.

## Interfaces / Contracts

```ts
type MutationCode =
  | "unauthorized" | "invalid_input" | "not_found"
  | "last_set" | "last_exercise" | "error";
type MutationResult = { ok: true } | { ok: false; code: MutationCode };

// New action inputs (schemas in src/lib/schemas/workout.ts):
type UpdateWorkoutInput = { workoutId: string; nameWorkout: string; dateWorkout: Date };
type DeleteWorkoutInput = { workoutId: string };
type AddSetsInput = {
  workoutId: string;
  exerciseId: string;
  sets: Array<{ weight: number; reps: number; isWarmup?: boolean }>;
};
type DeleteSetInput = { workoutId: string; setId: string };
type RemoveWorkoutExerciseInput = { workoutId: string; exerciseId: string };

// Data-layer signature; other helpers take (userId, validated input)
// and return { ok: true, tag } or { ok: false, code }.
declare function deleteOwnedWorkout(
  userId: string, workoutId: string,
): Promise<{ ok: true; tag: string } | { ok: false; code: "not_found" | "error" }>;
```

`UpdateWorkoutInput` reuses the create-time name/date validators but is independent of its tag/exercise-list shape. The add schema uses `setsSchema` (`z.array(setSchema).min(1)`) without a maximum; parsed warmup defaults to `false`, and parsed set values are explicitly projected to create rows, so an injected `order` is ignored. Action input types can be derived from the new schemas (`z.input`); these shapes describe the accepted payload, not permission to bypass runtime validation. Metadata updates use an owner-scoped conditional write and return the unchanged stored tag. All five actions use only the relevant codes from the union.

## Testing Strategy

| Layer | What to test | Approach |
|-------|--------------|----------|
| Unit: action RED first | Session before validation, invalid before lookup/write, owned vs foreign/missing/unrelated, code mapping, immutable tag, and exactly two success-only `revalidatePath` calls. | Co-located `*.test.ts` with `vi.hoisted`, `vi.mock("@/auth")`, `vi.mock("@/lib/prisma")`, `vi.mock("next/cache")`; mock the data-layer helper where appropriate and assert no writes/revalidation on failures. |
| Unit: data RED first | Transaction order and rollback on the parent-delete failure; correct guard predicates; conditional affected-row counts; P2034 retry with fresh guard read; exhausted retry; gap-preserving `max + 1` and `isWarmup`; unrelated workout unchanged. | Mock `$transaction` with a callback receiving a mocked transaction client. Assert requested `Serializable` isolation and retry boundaries; simulate aborts/throws, but do **not** claim the mock proves real rollback or PostgreSQL serialization. |
| Local DB verification | Real atomic rollback, restrictive FK, two simultaneous different-set deletions from two sets, two simultaneous different-exercise removals from two exercises, and two concurrent additions with distinct appended order values. | In the **isolated worktree Postgres on port 5434 only**, use disposable owned fixtures and two parallel calls/connections, then query persisted rows after each race/failure. Run outside CI's DB-free `pnpm test`; record actual results in verify phase. Never use the main checkout DB/port 5432. |
| Manual responsive/keyboard QA | Sheet opens without writes; overlay/Escape/close/Cancel do not delete; explicit Confirm alone deletes once; first inline tap does not delete, Cancel/switch resets, second tap deletes; last-item codes explain refusal; touch targets, focus, scroll, safe area, list/detail and old URL. | On the worktree dev server (port 3001), verify mobile viewport and keyboard with disposable fixtures; note pass/fail in verify report. Vitest is `environment: "node"`, includes only `src/**/*.test.ts`, and has no jsdom/Testing Library: **no automated DOM/component/E2E coverage is claimed**. |
| Delivery gates | Regression and compilation. | Run `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`; `prisma validate` is an additional CI check despite no schema change. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed. The existing `/workouts/[slug]` route remains keyed by the same stored tag; the newly designed mutations are handled under owner-scoped action/data-layer contracts above.

## Migration / Rollout

No migration required. Preserve `Set_workoutId_fkey ON DELETE RESTRICT`, non-unique `(workoutId, order)` index, and all stored order gaps. Gate destructive UI behind action and isolated-DB verification; confirm recoverable backup availability before release. If rollback is needed, remove the new controls and actions; already deleted records require backup recovery, not a code rollback. The forecast is 600–1,000 authored lines versus a 400-line review budget; task planning should expose reviewable work units, while the orchestrator decides PR splitting.

## Open Questions

- [ ] Confirm recoverable backup availability before enabling irreversible whole-workout deletion in a deployed environment. This does not block the technical design but blocks safe rollout.
- [ ] Cache invalidation occurs after commit, so a rare `revalidatePath` infrastructure failure cannot be rolled back together with the database transaction. Verify-phase evidence should distinguish commit success from cache failure rather than claiming cross-system atomicity.
