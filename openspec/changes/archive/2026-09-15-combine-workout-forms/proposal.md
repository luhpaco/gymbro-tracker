# Proposal: Unified Workout Creation Form

## Intent

`/workouts/create` today splits workout creation across two disconnected `react-hook-form` instances bridged by ad-hoc Zustand state: a modal dialog (`AddExerciseForm`) that the user must open, fill, and submit once per exercise, and a separate page-level form (`SummaryWorkoutForm`) for the workout name/date that only appears after all exercises are added and force-syncs its hidden fields outside `handleSubmit` via a submit-button `onClick` side effect. Nothing is persisted server-side until that final submit, so a user who adds several exercises and then refreshes or navigates away loses everything.

This change replaces both forms with a single, always-visible, multi-section form (name + date + a dynamic list of exercises, each with its own sets) using `react-hook-form`'s `useFieldArray`, submitted once via the existing `createWorkout` server action. To close the data-loss gap this consolidation exposes even further (previously exercises survived in memory across the same session at least; a true single form has the same problem at finer grain), the in-progress draft is persisted to `localStorage` so it survives a refresh or accidental navigation until the workout is actually saved.

## Scope

### In Scope

- Replace `DialogAddExercise` + `AddExerciseForm` + `SummaryWorkoutForm` with one unified form component rendering: `nameWorkout`, `dateWorkout`, and an inline, expandable list of exercises (`useFieldArray`), each with its own exercise picker and 1–5 sets (reps/weight), matching today's validation rules (`setSchema`, `AddExerciseFormSchema` shape) and UI primitives (Combobox, `TornStrip`, `Stat`).
- One `handleSubmit` call validates the whole form and calls `createWorkout` — no more force-set-outside-`handleSubmit` hack for `listExercises`/`tagWorkout`.
- Replace `SummaryWorkout`'s Zustand-backed inline `EditableStat` editing with standard `useFieldArray` field editing (still inline, on the same page, no dialog) so there is one state source (RHF) instead of two (RHF + Zustand).
- Draft persistence: the in-progress form values (name, date, exercises, sets) survive a page refresh or navigation away before saving, via a `localStorage`-backed mechanism, and are cleared once `createWorkout` succeeds.
- `useWorkoutStore` (`src/store/workout/workout-store.ts`) is replaced or substantially rewritten as part of this consolidation (its current per-exercise CRUD API no longer matches a single-form model); the dead-code redundant branch in today's `addExercise` is resolved by the rewrite, not carried forward.
- Update/replace existing unit tests for the removed store API and add coverage for the new draft-persistence behavior and the unified schema.

### Out of Scope

- Any change to `createWorkout`'s server-side contract, its Prisma write shape, or the `Workout`/`Set` schema.
- The exercise reference-data flow (`getExercises`, exercise creation/soft-delete/tag-uniqueness) — read-only input to this form, untouched.
- Editing an *existing* workout after creation (`/workouts/[slug]`) — out of scope, this change is create-only.
- Mobile-specific layout redesign beyond what's needed to keep the existing responsive behavior working with the new inline exercise list (no new breakpoints or design system work).

## Capabilities

### New Capabilities

- `workout-creation-form`: single-page, single-submission workout creation flow — name, date, and a dynamic exercise/set list collected and validated together, replacing the modal-dialog-per-exercise + disconnected-final-form pattern.
- `workout-draft-persistence`: the in-progress, unsaved workout draft (name, date, exercises, sets) survives a page refresh or navigation away, and is cleared once the workout is successfully saved.

### Modified Capabilities

None — there is no existing OpenSpec capability covering workout creation (`openspec/specs/` has none named `workout-*`); this introduces the domain fresh rather than amending one.

## Approach

1. **Schema**: keep `setSchema` and the shape of `AddExerciseFormSchema` (exercise + sets) as-is; fold both into one top-level schema (today's `AddWorkoutFormSchema` in `SummaryWorkoutForm.tsx` already nests `listExercises: AddExerciseFormSchema[]` — reuse that shape as the single source of truth) so no server-side (`createWorkout`) or Prisma-facing contract changes.
2. **Form**: one client component (replacing `CreateWorkoutPage`'s current composition of `DialogAddExercise` + `SummaryWorkout`) holds a single `useForm` + `useFieldArray("exercises")` (or `listExercises`, keeping the existing field name to minimize `createWorkout` call-site changes). Each field-array row renders the existing exercise Combobox + set stepper UI inline (no `Dialog` wrapper) instead of inside a modal.
3. **Editing existing rows**: replace `EditableStat`'s direct Zustand mutation with standard registered form inputs (or a controlled inline-edit UI wired to `useFieldArray`'s `update()`), so weight/reps editing goes through the same RHF instance and validation as everything else.
4. **Draft persistence**: watch the form (`form.watch()` or `useEffect` on relevant field changes) and debounce-write the serialized draft to `localStorage`; on mount, hydrate `defaultValues` from any existing draft (validating shape defensively before trusting it); clear the stored draft on successful `createWorkout` (mirrors the existing `form.reset()` + `resetExercises()` cleanup, adapted to the new single store).
5. **State cleanup**: remove `useWorkoutStore`'s current per-exercise CRUD API (`addExercise`/`removeExercise`/`updateSet`/`resetExercises`) since the field array replaces it; if a lightweight store is still useful as the persistence layer (e.g., for the `localStorage` sync), reshape it to hold the whole draft object instead of an exercise list. Remove `useUIStore`'s dialog-open state if nothing else uses it after `DialogAddExercise` is deleted (confirmed: today it's exclusive to this dialog).
6. **Tests**: replace `workout-store.test.ts`'s per-exercise-API assertions with tests matching the new store/persistence shape; add component or logic tests (Stage 1 scope: pure-logic units — schema validation, persistence serialize/deserialize helpers, any remaining store logic) covering the new draft save/restore/clear behavior.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(routes)/workouts/create/page.tsx` | Modified | Renders the new unified form instead of `DialogAddExercise` + `SummaryWorkout` |
| `src/components/workout/DialogAddExercise.tsx` | Removed | Modal wrapper no longer needed |
| `src/components/workout/AddExerciseForm.tsx` | Removed/merged | Exercise-row UI folded into the unified form's field-array rows |
| `src/components/workout/SummaryWorkout.tsx` | Removed/merged | Recap UI folded into the unified form; `EditableStat` usage replaced by RHF-bound fields |
| `src/components/workout/SummaryWorkoutForm.tsx` | Removed/merged | Name/date fields + submit folded into the unified form |
| New unified form component (path TBD in design) | New | Single `useForm` + `useFieldArray` component housing the whole flow |
| `src/store/workout/workout-store.ts` + `.test.ts` | Removed | Per-exercise CRUD API has no remaining callers once the form owns its own state; dead-code branch removed with the file |
| `src/components/navigation/AuthenticatedNavigationShell.tsx` | Modified | **Discovered during design (D4)**: also reads `useWorkoutStore(state => state.exercises.length)` for an unrelated mobile-dock-suppression signal. Repointed to a new minimal single-purpose store; its own logic/tests unchanged |
| `src/store/ui/ui-store.ts` | Removed | Only currently used for the dialog being removed — confirm no other usage before deleting |
| `src/actions/workout/create-workout.ts` | Unchanged (verify) | Contract (`CreateWorkoutFormData` shape) preserved so no server-side changes are required |
| New: draft-persistence helper/module | New | `localStorage` serialize/save/hydrate/clear logic (unit-testable in isolation) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `useFieldArray` re-render/perf regression with many exercises+sets nested fields | Low (workouts are small, capped at reasonable exercise/set counts today) | Cap sizes as today (max 5 sets/exercise); verify manually with a realistic multi-exercise workout before merge |
| Stored `localStorage` draft becomes stale/invalid after a schema change (e.g., a future field rename) and breaks hydration | Low-Med | Defensive `safeParse` on hydration; discard and start fresh silently on any validation failure rather than crashing |
| Removing `useUIStore`'s dialog state breaks an unnoticed second usage | Low (grep confirms `DialogAddExercise` is its only consumer today) | Re-grep at implementation time before deleting; keep the store file if any other usage surfaces |
| Losing the current per-exercise modal's focused, low-distraction entry UX (Q3/Q4 flagged in exploration: mobile layout, edit affordance) | Med — this is a genuine UX trade-off, not a defect | Addressed at design time: inline rows collapse/expand per exercise on mobile instead of a full accordion rewrite; scope stays minimal-viable per this proposal |
| `pnpm test` Stage 1 has no component/DOM tests yet (no `jsdom`/RTL) — the new form's interactive behavior can only be unit-tested at the logic/schema/persistence-helper level, not via rendered-component tests | Known/accepted | Manual smoke test of the full create flow (as done for prior workout/exercise changes) plus focused logic-layer unit tests |

## Rollback Plan

- Revert the PR (single feature branch, no DB/migration changes — pure frontend/store rewrite, so rollback is a plain `git revert`).
- No data migration risk: `createWorkout`'s persisted `Workout`/`Set` shape is unchanged; only the client-side authoring flow changes.

## Dependencies

- `react-hook-form` `useFieldArray` (already a project dependency via `react-hook-form` + `@hookform/resolvers/zod`, no new package).
- No new external service or library required for `localStorage` persistence (native Web Storage API); Zustand's own `persist` middleware may be used if a store is retained, or a small hand-rolled helper otherwise — decided at design time.

## Success Criteria

- [ ] User can add multiple exercises with sets on one continuous page, without any modal, and submit once to create the workout.
- [ ] Refreshing or navigating away mid-entry and returning restores the in-progress draft (name, date, exercises, sets already entered).
- [ ] Successful save clears the draft and behaves like today (toast, redirect to `/workouts`).
- [ ] `createWorkout`'s existing contract and Prisma write shape are unchanged — no server/schema migration needed.
- [ ] `pnpm test`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm build` all green.
- [ ] Manual smoke test: create a workout with 3+ exercises and multiple sets each, verify persistence across a refresh, verify final save and redirect.
