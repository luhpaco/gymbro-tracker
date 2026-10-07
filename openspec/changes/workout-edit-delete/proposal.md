# Proposal: Edit and Delete Saved Workouts

## Intent

Let users correct a saved workout after capture errors: rename or redate it, add or remove sets, remove an exercise, or delete the workout. Today only a saved set's weight and repetitions can change. Without these corrections, accidental extra sets or wrong exercises remain in history and distort progress and personal records.

## Scope

### In Scope

- Delete an owned workout and its sets with user confirmation; delete an individual set or remove an exercise and its sets from an owned workout.
- Edit an owned workout's name and performed date; add sets to an exercise already in that workout, retaining warmup support, workout-wide order, and no set cap.
- Add Zod-validated, owner-scoped server actions under `src/actions/workout/` and revalidate the workout detail and `/workouts` list after successful mutations.
- Add one-hand, mobile-oriented controls to `/workouts/[slug]`, centered on `WorkoutDetailSets.tsx` and neighboring components.
- Add Vitest mock-based action tests for validation, ownership, destructive effects, and cache invalidation; run the configured CI gates with strict TDD.

### Out of Scope

- Restoring deactivated exercises (soft delete has no restoration UI).
- Editing a session while it is in progress (F1.1).
- Migrating pre-existing user data; none exists to migrate for this change.

## Capabilities

### New Capabilities

- `saved-workout-management`: Post-save workout metadata edits and confirmed whole-workout deletion, including owner isolation, stable URLs, and list/detail refresh.
- `saved-workout-set-management`: Post-save set addition/deletion and exercise removal, including owner isolation, validation, and behavior at the last-set/last-exercise boundary.

### Modified Capabilities

- `workout-set-ordering`: Extend server-assigned workout-wide order and deterministic read-back requirements to sets added or removed after creation; deletion must preserve gaps without renumbering.
- `workout-set-validation`: Extend the shared set rules and no-upper-bound behavior to post-save additions, and specify how the existing at-least-one-exercise/at-least-one-set creation invariant applies after deletion (decision pending).

`workout-tag-uniqueness` already requires the stored tag to remain immutable, so compliance needs no delta unless the user explicitly authorizes changing that requirement. `workout-session-timestamps` continues to make `Workout.date` the performance date; `workout-creation-form` remains limited to creation. These are binding constraints, not modified capabilities in this proposal.

## Approach

Use the existing authenticated action, Zod, ownership-check, and result-handling patterns for post-save mutations; keep database access out of components. Preserve the stored tag when name or date changes, as the durable spec requires, so `/workouts/[slug]` links remain valid. Extend detail-page controls rather than changing the creation flow. Follow the exploration's preferred direction of an owner-checked, transactional application-level removal of sets before workout deletion, while leaving the delete mechanism and confirmation shape for explicit design approval. Assign new sets server-side after the existing maximum order; never compact order after deletion. Strict TDD starts with action tests using the existing `@/auth`, `@/lib/prisma`, and `next/cache` mocks.

### Decisions to Resolve Before Specs/Design Are Finalized

| Decision | Options and tradeoffs | Constraint / owner decision needed |
|---|---|---|
| Tag on rename or redate | **Immutable**: URLs remain valid, no collision retry, tag may no longer describe current metadata. **Recompute**: descriptive tag, but breaks saved URLs, needs collision retry and stale-link handling, and violates `workout-tag-uniqueness`. | Durable spec strongly favors immutability; recompute requires explicit user authorization and a spec change. Do not silently select it. |
| Workout deletion | **Application transaction**: delete owned workout's sets then workout atomically, no migration, but future paths must repeat the discipline. **`onDelete: Cascade`**: simpler delete operation and DB-enforced cleanup, but requires a generated migration and changes FK behavior globally. | Current `Set_workoutId_fkey` is `ON DELETE RESTRICT` (`prisma/migrations/20240710014202_create_set_table_and_relations/migration.sql:13`); a bare workout delete fails. Confirm the mechanism before design. |
| Confirmation UX | **New bottom-sheet confirmation composed from `src/components/ui/dialog.tsx`**: fits one-hand use, adds a component and validation burden. **Inline confirmation**: smaller surface, but easier to trigger or lose context unless interaction is carefully gated. | No `AlertDialog` exists, and current Vitest Stage 1 uses a node environment with no component/DOM test harness; define how confirmation is verified. |

Spec phase must also resolve whether deleting the last set or last exercise may leave an empty saved workout, must be blocked, or should lead to explicit workout deletion; creation currently requires at least one exercise and one set. Decide whether `updateSet`'s codeless `{ ok: boolean }` is aligned to the coded-union failure pattern used by `setExerciseActiveState`, and define the exercise scope/ownership and inactive-exercise policy for sets added to an already-saved exercise. These are behavior-contract decisions, not implementation details to infer.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/workout/` | New / Modified | Owner-scoped mutation actions, validation, result contracts, and detail/list revalidation. |
| `src/lib/schemas/workout.ts`, `src/lib/schemas/workout-set.ts` | Modified | Reuse or extend validation for post-save inputs without diverging from shared set rules. |
| `src/components/workout/WorkoutDetailSets.tsx`, `src/app/(routes)/workouts/[slug]/page.tsx` | Modified | Post-save controls, confirmation, and stable route behavior. |
| `src/components/ui/dialog.tsx` | Reused | Potential primitive for a new confirmation composition, not an existing alert dialog. |
| `openspec/specs/workout-set-ordering/spec.md`, `openspec/specs/workout-set-validation/spec.md` | Modified at archive | New post-save behavior specified by delta specs. |
| `prisma/schema.prisma`, `prisma/migrations/` | Conditional | Only if the user chooses DB-level cascade; migration must be generated, never hand-edited. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Irreversible deletion of workouts and sets, including accidental taps | Medium | Explicit confirmation for whole-workout deletion; define per-row safeguards and clear destructive feedback; test atomic deletion. Reverting code cannot recover deleted rows. |
| Cross-user mutation or existence leakage | Medium | Require session and owner-scoped lookup on every action; treat missing and foreign resources alike; test foreign and unauthenticated cases. |
| FK-restricted delete or partial set cleanup | Medium | Choose and test transaction or generated cascade migration before enabling hard delete. |
| Broken URLs or inconsistent progress dates | Low if constraints held | Keep stored tag unchanged; keep `Workout.date` authoritative for list/detail and progress. |
| Set ordering/empty-workout behavior regresses | Medium | Specify last-item semantics and preserve gap-tolerant order in tests before implementation. |
| Mobile confirmation is not covered by current node-only tests | Medium | Specify a focused verification plan for UI interaction; do not claim DOM coverage without a harness. |

## Rollback Plan

Disable the new edit/delete controls and revert their actions and UI if validation or ownership fails; preserve the existing create/read/update-set paths and unchanged tags. If cascade was selected, revert application behavior first and use a new forward migration to restore the previous FK semantics rather than editing an applied migration. Already deleted data is not restored by code rollback; recovery requires a verified database backup, so confirm backup availability before enabling destructive deletion.

## Dependencies and Delivery Shape

- Resolve the three decision rows and the last-item/result-contract/exercise-scope questions before finalizing specs and design; no external service is required.
- Forecast approximately **600–1,000 authored changed lines** across actions, tests, and mobile UI, plus a possible generated migration. This is a planning estimate, not a diff; it likely exceeds the 400-line review budget. The tasks phase should forecast work units, while the orchestrator decides delivery/PR splitting.

## Success Criteria

- [ ] An authenticated user can delete their own workout (and its sets) after confirmation but cannot mutate another user's workout or sets; missing/foreign resources do not disclose ownership.
- [ ] A saved workout's name and performance date can change without changing its stored tag or breaking its existing detail URL.
- [ ] Users can add/remove sets and remove exercises on saved workouts under the agreed last-item rule; warmups and gap-tolerant workout-wide order remain correct, without a set cap.
- [ ] Every mutation validates inputs with Zod before database writes, enforces owner isolation, and refreshes both detail and list views after success.
- [ ] Vitest action tests cover successful edits/deletes, invalid input, unauthenticated/foreign access, ordering, and failure paths using the established mocks.
- [ ] `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, and `pnpm exec tsc --noEmit` pass.

## Resolved Decisions

Decisions 1–4 were confirmed by the user (2026-09-22). Decisions 5–6 are orchestrator calls recorded for the spec and design phases and remain open to user override.

| # | Decision | Resolution | Status |
|---|---|---|---|
| 1 | Tag on rename or redate | **Immutable.** Editing `name`/`date` never recomputes `tag`; existing `/workouts/[slug]` URLs, bookmarks, and breadcrumbs stay valid, and `workout-tag-uniqueness` needs no delta. | User-confirmed |
| 2 | Workout deletion | **Application-level transaction.** An owner-scoped data-layer helper deletes the workout's sets and then the workout atomically. No migration; `Set_workoutId_fkey` stays `ON DELETE RESTRICT`, so a future delete path that forgets the cleanup fails loudly instead of silently destroying history. | User-confirmed |
| 3 | Confirmation UX | **Staggered.** A bottom-sheet confirmation for whole-workout deletion (high impact, irreversible, explicitly required by the ticket) and a two-tap inline confirmation for set/exercise removal (low impact, keeps the one-hand flow fluent). | User-confirmed |
| 4 | Last set or exercise | **Blocked.** Removing the final set or the final exercise of a saved workout is refused with its own result code and explained in the UI; the create-time ≥1 set / ≥1 exercise invariant is preserved and no read path has to tolerate an empty saved workout. | User-confirmed |
| 5 | `updateSet` result contract | **Out of scope.** New actions follow the coded-union pattern of `setExerciseActiveState`; `updateSet`'s codeless `{ ok: boolean }` is left as-is and recorded as a follow-up rather than expanded into this change. | Orchestrator call |
| 6 | Sets added to a saved exercise | **Existing exercises only; active state does not block.** Sets are added to an exercise already present in that workout, including one deactivated afterwards (it still owns its history). Adding a brand-new exercise through a picker is not part of this change. | Orchestrator call |
