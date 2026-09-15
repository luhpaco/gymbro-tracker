# Design: Unified Workout Creation Form

## 1. Architecture Summary

`/workouts/create` moves from two disconnected `react-hook-form` instances bridged by `useWorkoutStore` to one `useForm` + `useFieldArray("listExercises")` instance owning the whole authoring flow. A new pure `localStorage` helper module persists/restores/clears the draft — no Zustand `persist` middleware, since the form itself is already the single source of truth and only needs a side-channel to survive reload. `useWorkoutStore`'s per-exercise CRUD API is deleted entirely. A design-time discovery (not visible from the proposal's file-level grep) is documented below: `AuthenticatedNavigationShell` also reads `useWorkoutStore` for an unrelated cross-cutting concern (mobile dock suppression) and needs a narrow, separate replacement — not a reason to keep the old CRUD API around.

## 2. Decisions

### D1. One `useForm` + `useFieldArray("listExercises")`, no dialog

**Rationale.** Directly implements the approved scope (Approach 1). Reuse the existing schema shape: `AddWorkoutFormSchema` (currently defined in `SummaryWorkoutForm.tsx`) already nests `listExercises: AddExerciseFormSchema[]` — this becomes the single top-level schema for the new component, unchanged in shape, so `createWorkout`'s input contract needs no changes.

**Nested sets.** Each `listExercises[i].sets` is itself a nested `useFieldArray` (RHF supports nested field arrays), replacing today's manual `field.value.length` +/- stepper logic in `AddExerciseForm` with `append`/`remove` on the nested array. Cap stays 1–5 sets per exercise, enforced by both the nested array's `append`/`remove` guards and the existing `setsSchema` `.min(1).max(5)`.

### D2. Reuse `EditableStat` unchanged, wire it to `useFieldArray`'s `update()`

**Rationale.** `EditableStat` (`src/components/ui/editable-stat.tsx`) is already a decoupled, controlled `value`/`onCommit` component with no Zustand dependency — it does not need to change at all. Each rendered set row calls the nested `useFieldArray`'s `update(setIndex, { ...current, weight/reps: next })` (or `setValue` on the specific path) from `onCommit`. This resolves the open question from exploration about `EditableStat`'s fate: **keep it as-is**, just repoint its commit target from the Zustand store to RHF. No visual/UX change for the user — tap-to-edit behavior is identical.

### D3. Draft persistence: plain `localStorage` helper module, not Zustand `persist`

**Rationale.** The form (RHF) is already the canonical live state; a Zustand store mirroring it would be a second source of truth to keep in sync — the exact class of bug this change is removing. Instead, a small pure module (`src/lib/workout-draft.ts`) exposes:

```ts
const DRAFT_KEY = "gymbro:workout-draft:v1";
function saveDraft(data: WorkoutDraft): void
function loadDraft(): WorkoutDraft | null   // safeParse against the Zod schema; null on any failure
function clearDraft(): void
```

The form component watches `form.watch()` (debounced, e.g. via a `useEffect` + a short `setTimeout`/`lodash.debounce`-free manual debounce — no new dependency needed for a simple timer) and calls `saveDraft` on change. On mount, `loadDraft()` feeds `useForm`'s `defaultValues` (via `useEffect` + `form.reset(draft)` after mount, since `defaultValues` can't easily be async/conditional without a flash of empty state — accept a one-frame empty render, consistent with existing RSC-then-hydrate patterns in this app). `clearDraft()` runs alongside today's `form.reset()` in the successful-submit path.

**Why pure functions, not a hook or store.** Directly unit-testable under Stage 1 (pure-logic units, no DOM/jsdom needed) with a mocked `localStorage` — matches `testing.md`'s current scope exactly, no new test infrastructure required.

### D4. Discovery: `AuthenticatedNavigationShell` also reads `useWorkoutStore` — needs its own minimal store

**Finding.** `src/components/navigation/AuthenticatedNavigationShell.tsx:124` reads `useWorkoutStore((state) => state.exercises.length)` to compute `dockSuppressed` via the already-tested pure function `shouldSuppressMobileDock(pathname, exerciseCount)` (`src/components/navigation/navigation-state.ts`) — suppressing a mobile dock UI while the user has in-progress exercises on `/workouts/create`. This is a cross-cutting layout concern, unrelated to the form's own authoring/persistence logic, and was not visible from the proposal's per-file `grep` (it greps for `DialogAddExercise`/`useUIStore`, not `useWorkoutStore`).

**Resolution.** `shouldSuppressMobileDock` and its existing unit tests (`navigation-state.test.ts`) are **untouched** — it's a pure function of `(pathname, count)`, agnostic to where `count` comes from. Introduce one minimal, single-purpose Zustand store (e.g. `useWorkoutDraftSignalStore` in `src/store/workout/workout-draft-signal-store.ts`) holding only `{ exerciseCount: number; setExerciseCount: (n: number) => void }`. The unified form component updates it via a `useEffect` watching `fields.length` from its `useFieldArray`; `AuthenticatedNavigationShell` reads only `exerciseCount` from it, unchanged in every other respect. This keeps the global signal (needed cross-tree) fully separate from the deleted per-exercise CRUD API (not needed anywhere once the form owns its own state) and from the persistence helper (a pure module, not a store).

**Why not read `localStorage` directly in the nav shell instead.** Would couple an unrelated layout component to the draft's storage format/versioning (`DRAFT_KEY`, schema shape) and to `localStorage` availability/timing (SSR/hydration), for a value the form already computes for free from its own live field-array length. A 6-line store is simpler and keeps the coupling one-directional (form → signal store → nav shell reads).

### D5. `useWorkoutStore`'s per-exercise CRUD API is deleted, not deprecated

**Rationale.** `addExercise`/`removeExercise`/`updateSet`/`resetExercises` have no remaining callers once `AddExerciseForm`, `SummaryWorkout`, and `SummaryWorkoutForm` are removed/merged (confirmed: `AuthenticatedNavigationShell` only ever read `exercises.length`, never called any mutator). Today's dead-code redundant branch in `addExercise` (`if (exercises.length === 0) set(...)` immediately followed by an unconditional `set(...)` using the pre-set closure value) disappears with the file, per the user's confirmed decision to fold this cleanup into the rewrite rather than a separate Housekeeping ticket. `workout-store.test.ts` is replaced by tests for the new signal store (trivial: set/read a number) and for `workout-draft.ts`'s pure functions.

### D6. `useUIStore`'s dialog state is removed

**Rationale.** Confirmed via grep: `isDialogOpen`/`openDialog`/`closeDialog` (`src/store/ui/ui-store.ts`) have exactly one consumer today, `DialogAddExercise`, which is deleted by this change. Remove the store file; re-grep at implementation time immediately before deleting, per the proposal's risk mitigation, in case something new started using it since exploration.

## 3. Component Contract

| Surface | Kind | Change | Contract |
|---|---|---|---|
| `src/app/(routes)/workouts/create/page.tsx` | Modified | Renders one new component instead of `DialogAddExercise` + `SummaryWorkout` | Still an RSC fetching `getExercises()` and passing it down as a prop |
| `src/components/workout/WorkoutCreationForm.tsx` | New | `useForm` + `useFieldArray("listExercises")`, nested set field arrays, inline exercise picker + `EditableStat` rows, submits to `createWorkout` | Owns the entire authoring UI; replaces `DialogAddExercise`, `AddExerciseForm`, `SummaryWorkout`, `SummaryWorkoutForm` |
| `src/components/workout/DialogAddExercise.tsx` | Removed | — | — |
| `src/components/workout/AddExerciseForm.tsx` | Removed | Its exercise-picker + set-stepper JSX is inlined into `WorkoutCreationForm`'s field-array row renderer | `AddExerciseFormSchema` and `setSchema`/`setsSchema` re-exported or relocated (design detail for tasks: keep in a schema-only module, e.g. move to `src/lib/schemas/workout.ts`, since the component that used to own them is deleted) |
| `src/components/workout/SummaryWorkout.tsx` | Removed | Recap rendering inlined into `WorkoutCreationForm`; `EditableStat` wiring per D2 | — |
| `src/components/workout/SummaryWorkoutForm.tsx` | Removed | Name/date fields inlined into `WorkoutCreationForm`; `CreateWorkoutFormData` type relocated alongside the schema (used by `create-workout.ts`) | — |
| `src/lib/workout-draft.ts` | New | Pure `saveDraft`/`loadDraft`/`clearDraft` against `localStorage`, `safeParse`-guarded | Unit-testable without DOM |
| `src/store/workout/workout-store.ts` + `.test.ts` | Removed | Per-exercise CRUD API has no remaining callers | — |
| `src/store/workout/workout-draft-signal-store.ts` + test | New | `{ exerciseCount, setExerciseCount }` only | Sole purpose: feed `AuthenticatedNavigationShell`'s `shouldSuppressMobileDock` call |
| `src/components/navigation/AuthenticatedNavigationShell.tsx` | Modified | Line 124: read `useWorkoutDraftSignalStore` instead of `useWorkoutStore` | `shouldSuppressMobileDock` call and its test file are unchanged |
| `src/store/ui/ui-store.ts` | Removed | No remaining consumer after `DialogAddExercise` is deleted | Re-verify via grep immediately before deletion |
| `src/actions/workout/create-workout.ts` | Unchanged | — | `CreateWorkoutFormData` shape preserved (relocated import source only) |
| `src/store/index.ts` | Modified | Drop `export * from "./workout/workout-store"`; add the new signal-store export; drop the `ui-store` export if removed | Barrel stays consistent |

## 4. Flows

### Flow A — happy path authoring and save

1. User opens `/workouts/create`. `WorkoutCreationForm` mounts, `loadDraft()` returns `null` (first visit) → empty defaults.
2. User fills name, date, adds an exercise (field-array `append`), adds sets (nested `append`), edits a set via `EditableStat` → nested `update()`.
3. Each change triggers the debounced `saveDraft()`; `exerciseCount` pushed to the signal store on every `fields.length` change.
4. User submits. `handleSubmit` validates the whole tree once, calls `createWorkout(data)`.
5. On success: `clearDraft()`, `form.reset()`, signal store reset to 0, toast, redirect to `/workouts` — mirrors today's `SummaryWorkoutForm` success path.

### Flow B — refresh mid-entry

1. User has added 2 exercises, not yet submitted. `saveDraft()` has already persisted the current values.
2. User refreshes. `WorkoutCreationForm` remounts, `loadDraft()` returns the stored draft, `safeParse` succeeds, `form.reset(draft)` restores all fields, signal store re-synced from the restored `listExercises.length`.

### Flow C — malformed stored draft

1. `localStorage` holds a value under `DRAFT_KEY` that is invalid JSON or fails the Zod `safeParse`.
2. `loadDraft()` catches/returns `null` without throwing. Form renders with empty defaults, as if no draft existed. No user-visible error.

## 5. Verification Strategy per Spec Scenario

Stage 1 testing scope (per `testing.md`) has no component/DOM tests yet (no `jsdom`/RTL). Coverage below splits into pure-logic unit tests (feasible now) and a required manual smoke test (documented, not automated) for anything needing rendered interaction.

| Spec scenario | Unit (`pnpm test`) | Manual smoke |
|---|---|---|
| Exercises added inline (no dialog) | — | ✅ |
| Name/date always visible | — | ✅ |
| One submit creates the workout | — | ✅ |
| Validation blocks incomplete submission | schema-level test on the combined Zod schema (`.min(1)` on `listExercises`) | ✅ |
| Server contract unchanged | existing `create-workout` action tests, unchanged | — |
| Editing an already-added set | — | ✅ |
| Removing an exercise | — | ✅ |
| Draft restored after refresh | ✅ `workout-draft.ts`: `saveDraft` → `loadDraft` round-trip | ✅ (confirms wiring) |
| Draft restored after navigating away | — (same mechanism as above, DOM-level) | ✅ |
| Empty form persists nothing meaningful | ✅ `loadDraft()` on empty/absent key returns `null` | — |
| Draft cleared after successful creation | ✅ `clearDraft()` removes the key | ✅ (confirms call site) |
| Malformed stored draft ignored safely | ✅ `loadDraft()` with invalid JSON and with schema-invalid JSON, both → `null`, no throw | — |

**Summary:** 6/12 scenarios covered by pure-logic unit tests, all 12 covered by the required manual smoke test (create flow with 3+ exercises, refresh mid-entry, final save+redirect — same bar as prior workout/exercise changes in this project). 0 unverified.

## 6. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nested `useFieldArray` re-render cost with many exercises/sets | Low (workouts capped at reasonable sizes; existing 5-sets-per-exercise cap retained) | Low | Manual smoke test with a realistic multi-exercise workout before merge |
| Draft persistence debounce causes a stale/partial write on rapid navigation away | Low | Low (worst case: draft slightly behind, still restorable) | Keep debounce short (e.g. 300ms); also save once more on `beforeunload`/component unmount if trivial to add, otherwise accept the small window |
| `AuthenticatedNavigationShell` coupling missed at grep time (D4) turns out to have further undiscovered consumers of `useWorkoutStore` | Low (full-repo grep in this design phase found exactly these two files) | Med if missed | Re-grep for `useWorkoutStore` immediately before deleting the file, same discipline as `useUIStore` |
| Schema/type relocation (`AddExerciseFormSchema`, `CreateWorkoutFormData`) breaks an import elsewhere | Low | Low | Grep for both identifiers repo-wide before deleting their current source files; update all imports in the same commit |
| Zod validation timing regression (today's submit-button `onClick` hack silently no-oped on some invalid states) | — this change removes the hack entirely | — | New behavior is strictly better (real validation errors instead of silent no-op) — call out explicitly in manual smoke test |

## 7. Out-of-Scope (recorded)

`createWorkout`'s server contract/Prisma shape, exercise reference-data flow, editing an existing workout post-creation, new responsive breakpoints/design-system work beyond keeping current responsiveness.

## 8. Rollback

Plain `git revert` — no DB/migration involved, pure frontend + store rewrite. `createWorkout`'s persisted data shape is unaffected regardless of rollback.
