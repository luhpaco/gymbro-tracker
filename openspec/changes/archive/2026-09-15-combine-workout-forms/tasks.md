# Tasks: Unified Workout Creation Form

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1300–1500 (deletions: `DialogAddExercise` 43, `AddExerciseForm` 221, `SummaryWorkout` 124, `SummaryWorkoutForm` 179, `workout-store.ts`+test 153, `ui-store.ts` 13 ≈ 733 lines removed; additions: new `WorkoutCreationForm` ~350–450, `workout-draft.ts`+tests ~120, `workout-draft-signal-store.ts`+test ~40, relocated schema module+tests ~90, nav shell + page.tsx + barrel wiring ~20 ≈ ~620–720 lines added) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 2 chained PRs — PR 1: new pure/testable modules (additive, no behavior change yet); PR 2: component rewrite that consumes PR 1 and deletes the old components/stores |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending user decision |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Relocate/consolidate schemas + new pure `workout-draft.ts` persistence helper + new minimal `workout-draft-signal-store.ts`, all with unit tests | PR 1 | `pnpm test -- --run src/lib/schemas/workout.test.ts src/lib/workout-draft.test.ts src/store/workout/workout-draft-signal-store.test.ts` | Vitest, pure logic, no DOM needed | New/moved files only; revertable independently, no consumer wired yet |
| 2 | New `WorkoutCreationForm` component wired into the create page; delete `DialogAddExercise`/`AddExerciseForm`/`SummaryWorkout`/`SummaryWorkoutForm`; repoint `AuthenticatedNavigationShell`; delete `workout-store.ts`+test and `ui-store.ts`; update `src/store/index.ts` barrel | PR 2 (depends on PR 1) | `pnpm test` (full suite — `navigation-state.test.ts` regression guard) + manual smoke test (see Phase 6) | Manual smoke test — Stage 1 has no component/DOM harness | Single feature branch on top of PR 1; revert = `git revert`, no DB/migration involved |

## Phase 1: Schema Consolidation — Additive Only (PR1)

**Design note (found while re-checking consumers before implementation):** `setSchema` (from `workout-set.ts`) is also imported directly by `src/actions/workout/update-set.ts` and `src/components/workout/WorkoutDetailSets.tsx` — both part of the *existing-workout detail/edit* flow (`/workouts/[slug]`), explicitly out of scope for this change. PR1 therefore creates the new consolidated module **standalone** (fresh definitions, not re-exported from or re-exporting into the old files) and touches zero existing files. `AddExerciseForm.tsx`, `SummaryWorkoutForm.tsx`, `workout-set.ts`, `update-set.ts`, and `WorkoutDetailSets.tsx` are untouched until PR2 (Phase 5), which is the only place old consumers get repointed or deleted. This keeps PR1 purely additive with zero regression risk to the untouched detail/edit flow.

- [x] 1.1 Create `src/lib/schemas/workout.ts` with fresh definitions (byte-identical validation rules to today's originals, but a standalone module — not importing from or re-exporting the old files): `setSchema`, `setsSchema`, `AddExerciseFormSchema`, `AddWorkoutFormSchema`, and the `CreateWorkoutFormData` type.
- [x] 1.2 **RED** — Create `src/lib/schemas/workout.test.ts` with tests for the new module: port every existing `workout-set.test.ts` assertion (valid set, numeric coercion, reps-below-min, weight-below-min) against the new `setSchema`, plus new assertions for `setsSchema` (`.min(1)`/`.max(5)`) and `AddWorkoutFormSchema` (`.min(1)` on `listExercises`, required `dateWorkout`, required non-empty `nameWorkout`). Confirm all FAIL (module doesn't exist yet).
- [x] 1.3 **GREEN** — Confirm `pnpm test -- --run src/lib/schemas/workout.test.ts` passes once 1.1 is implemented.
- [x] 1.4 Do NOT modify `workout-set.ts`, `AddExerciseForm.tsx`, `SummaryWorkoutForm.tsx`, `update-set.ts`, or `WorkoutDetailSets.tsx` in this PR — confirmed out of scope for PR1 by the consumer grep above.

## Phase 2: Draft Persistence Helper (RED → GREEN)

- [x] 2.1 **RED** — Create `src/lib/workout-draft.test.ts` with failing tests: (a) `loadDraft()` returns `null` when `localStorage` has no value for the draft key; (b) `saveDraft(data)` followed by `loadDraft()` round-trips the same data; (c) `loadDraft()` returns `null` (no throw) when the stored value is invalid JSON; (d) `loadDraft()` returns `null` (no throw) when the stored value is valid JSON but fails the workout schema's `safeParse`; (e) `clearDraft()` removes the key so a subsequent `loadDraft()` returns `null`. Mock `localStorage` (Vitest `vi.stubGlobal` or a simple in-memory mock — no `jsdom` needed for pure `localStorage` mocking). (spec: `workout-draft-persistence` — all 4 requirements)
- [x] 2.2 Run `pnpm test -- --run src/lib/workout-draft.test.ts` — confirm all 5 tests FAIL (module doesn't exist yet).
- [x] 2.3 **GREEN** — Implement `src/lib/workout-draft.ts`: `const DRAFT_KEY = "gymbro:workout-draft:v1"`; `saveDraft(data: WorkoutDraft): void` (`JSON.stringify` + `localStorage.setItem`); `loadDraft(): WorkoutDraft | null` (`localStorage.getItem` → `JSON.parse` in try/catch → `safeParse` against the Phase 1 schema → `null` on any failure); `clearDraft(): void` (`localStorage.removeItem`).
- [x] 2.4 Run `pnpm test -- --run src/lib/workout-draft.test.ts` — confirm all 5 tests PASS.

## Phase 3: Draft Signal Store (RED → GREEN)

- [x] 3.1 **RED** — Create `src/store/workout/workout-draft-signal-store.test.ts`: failing tests for initial `exerciseCount === 0` and `setExerciseCount(n)` updating the state to `n`.
- [x] 3.2 **GREEN** — Implement `src/store/workout/workout-draft-signal-store.ts`: a minimal Zustand store `{ exerciseCount: number; setExerciseCount: (n: number) => void }`. No persistence, no other fields — single purpose per design D4.
- [x] 3.3 Run `pnpm test -- --run src/store/workout/workout-draft-signal-store.test.ts` — confirm PASS.

## Phase 4: `WorkoutCreationForm` Component (manual-smoke-verified — no component test harness in Stage 1)

- [x] 4.1 Create `src/components/workout/WorkoutCreationForm.tsx`: single `useForm` with the Phase 1 consolidated schema as resolver, `useFieldArray({ control, name: "listExercises" })` for exercises, nested `useFieldArray` per exercise row for `sets` (1–5 cap enforced by `append`/`remove` guards, matching today's stepper limits).
- [x] 4.2 Render `nameWorkout` + `dateWorkout` fields at the top, always visible (reuse existing `Input`/`Popover`/`Calendar` UI exactly as in current `SummaryWorkoutForm`). (spec: `workout-creation-form` → "Name and date are always visible")
- [x] 4.3 Render each exercise row inline (no `Dialog`): exercise Combobox (reuse `AddExerciseForm`'s picker JSX/logic against the `exercisesCreated` prop), an "Add exercise" button that `append`s a new blank row, a "Remove" button per row that `remove`s it. (spec: "Exercises are added inline", "Removing an exercise")
- [x] 4.4 Render each set row using `EditableStat` (`src/components/ui/editable-stat.tsx`, **unchanged**) with `onCommit` wired to the nested field array's `update(setIndex, { ...current, [field]: next })`, reusing `validateWeight`/`validateReps` logic from today's `SummaryWorkout.tsx` against the relocated `setSchema`. (spec: "Editing an already-added set" — design D2)
- [x] 4.5 Wire the debounced draft save: `useEffect` on `form.watch()` (or the specific watched fields) → `saveDraft()` after a short debounce (~300ms, plain `setTimeout`, no new dependency). (spec: "Draft survives refresh and navigation")
- [x] 4.6 Wire draft hydration on mount: `useEffect` calling `loadDraft()` once → `form.reset(draft)` if non-null. (spec: "Draft restored after refresh", "Draft restored after navigating away and back")
- [x] 4.7 Wire the signal store: `useEffect` on the exercises field array's `fields.length` → `setExerciseCount(fields.length)` (and reset to 0 on successful submit / unmount cleanup as appropriate).
- [x] 4.8 Implement `onSubmit`: call `createWorkout(data)` with the exact same payload shape `CreateWorkoutFormData` expects today; on success, call `clearDraft()`, `form.reset()`, `setExerciseCount(0)`, toast, `router.push("/workouts")`; on failure, toast the error (mirror today's try/catch in `SummaryWorkoutForm`). (spec: "One submit creates the workout", "Server contract is unchanged")
- [x] 4.9 Confirm the form's own Zod validation blocks submission when `listExercises` is empty (schema already has `.min(1)`) — no custom submit-button guard logic (removes today's `onClick` force-set hack entirely). (spec: "Validation blocks an incomplete submission")

## Phase 5: Wire the Page, Remove Old Components

- [x] 5.1 Update `src/app/(routes)/workouts/create/page.tsx` to render `<WorkoutCreationForm exercisesCreated={allExercisesCreated} />` instead of `<DialogAddExercise>` + `<SummaryWorkout>`.
- [x] 5.2 Delete `src/components/workout/DialogAddExercise.tsx`, `src/components/workout/AddExerciseForm.tsx`, `src/components/workout/SummaryWorkout.tsx`, `src/components/workout/SummaryWorkoutForm.tsx`.
- [x] 5.3 Update `src/components/index.ts` (or wherever these were barrel-exported) to remove the deleted components' exports and add `WorkoutCreationForm`.
- [x] 5.4 Update `src/actions/workout/create-workout.ts`'s import of `CreateWorkoutFormData` to the relocated `src/lib/schemas/workout.ts` path.
- [x] 5.5 Re-run the Phase 1.4 repo-wide grep for the consolidated schema identifiers — confirm every remaining consumer now imports from `src/lib/schemas/workout.ts` and no dangling import to a deleted file remains.

## Phase 6: Navigation Shell Repoint + Store Cleanup

- [x] 6.1 In `src/components/navigation/AuthenticatedNavigationShell.tsx`, replace `useWorkoutStore((state) => state.exercises.length)` with the new `useWorkoutDraftSignalStore((state) => state.exerciseCount)`. Do not touch `shouldSuppressMobileDock` or `navigation-state.ts`/its tests.
- [x] 6.2 Run `pnpm test -- --run src/components/navigation/navigation-state.test.ts` — confirm still PASS unmodified (regression guard for D4).
- [x] 6.3 Grep repo-wide for `useWorkoutStore` — confirm zero remaining consumers (expected: none, after 5.2 and 6.1). If any unexpected consumer surfaces, STOP and re-evaluate before deleting.
- [x] 6.4 Delete `src/store/workout/workout-store.ts` and `src/store/workout/workout-store.test.ts`.
- [x] 6.5 Grep repo-wide for `useUIStore`, `isDialogOpen`, `openDialog`, `closeDialog` — confirm zero remaining consumers (expected: none, after 5.2). If any unexpected consumer surfaces, STOP and keep `ui-store.ts`.
- [x] 6.6 Delete `src/store/ui/ui-store.ts` (only if 6.5 confirms no remaining consumer).
- [x] 6.7 Update `src/store/index.ts`: remove `export * from "./workout/workout-store"` (and the `ui-store` export if 6.6 ran), add `export * from "./workout/workout-draft-signal-store"`.

## Phase 7: Final Gates

- [x] 7.1 Run `pnpm test` — all suites green (including the relocated schema tests, new `workout-draft`/signal-store tests, and unmodified `navigation-state.test.ts`).
- [x] 7.2 Run `pnpm exec tsc --noEmit` — zero type errors.
- [x] 7.3 Run `pnpm lint` — zero lint errors.
- [x] 7.4 Run `pnpm run format:check` — formatting clean.
- [x] 7.5 Run `pnpm build` — production build succeeds (CI gate).
- [ ] 7.6 **Manual smoke test** (required — Stage 1 has no component/DOM harness): create a workout with 3+ exercises, multiple sets each, varying reps/weight; edit a set inline after adding it; remove one exercise; refresh mid-entry and confirm the draft restores; submit and confirm redirect to `/workouts` + the new workout appears with correct data; confirm the mobile dock is suppressed while exercises are present on `/workouts/create` and re-appears after navigating away or after a successful save.
