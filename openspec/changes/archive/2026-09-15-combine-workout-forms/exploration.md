# Exploration: Combine Workout Creation Forms

## Backlog Source

Notion (Gymbro Tracker — Backlog): "Improve UI/UX when creating a workout (combine forms)". Tipo: Feature, Prioridad: Baja. Notas: "Improve UI/UX when a user create a workout (combine both forms maybe). Equipo: Diseño. Migrated from Tablero Kanban legacy." Fase/Referencia: `workouts/`.

The note is a legacy Kanban migration item, not a spec — this exploration identifies what "both forms" means concretely and the current friction, without proposing a solution yet.

## Current Flow (`/workouts/create`)

Entry point: `src/app/(routes)/workouts/create/page.tsx` (RSC, fetches `getExercises()` server-side).

Two independent `react-hook-form` instances are involved, with a Zustand store (`useWorkoutStore`, `src/store/workout/workout-store.ts`) bridging them:

1. **Form #1 — `AddExerciseForm`** (`src/components/workout/AddExerciseForm.tsx`), rendered inside `DialogAddExercise` (`src/components/workout/DialogAddExercise.tsx`), a shadcn `Dialog` opened via the "Registrar ejercicio" button and `useUIStore`.
   - Fields: exercise picker (Combobox over `getExercises()` results), a set counter (2–5 sets via +/- buttons), and per-set `reps`/`weight` inputs (`setSchema` from `src/lib/schemas/workout-set.ts`).
   - On submit: calls `useWorkoutStore().addExercise(data)` (pure client state, no server call) and closes the dialog. **The user repeats this entire dialog flow once per exercise** — there is no "add another set of exercise" without reopening the dialog from scratch.
   - Schema: `AddExerciseFormSchema` (exported from this file and re-imported by `SummaryWorkoutForm`).

2. **Read-only recap — `SummaryWorkout`** (`src/components/workout/SummaryWorkout.tsx`): renders the accumulated `exercises` from the store, with inline-editable weight/reps per set via `EditableStat` (not a form — direct store mutation through `updateSet`). Shows "pending" placeholder slots up to 3 rows. Includes a delete-exercise button per row.

3. **Form #2 — `SummaryWorkoutForm`** (`src/components/workout/SummaryWorkoutForm.tsx`), rendered at the bottom of `SummaryWorkout`.
   - Fields: `nameWorkout` (text), `dateWorkout` (calendar popover), plus **hidden** `tagWorkout` and `listExercises` fields that are populated as a side effect inside the submit `<Button onClick>` handler — *before* `handleSubmit` runs, and only if `exerciseList.length > 0 && nameWorkout.length > 1` (this condition is separate from and inconsistent with the Zod schema's own `.min(1)` validations, so the button can silently no-op instead of showing form errors).
   - On submit: calls the `createWorkout` server action, resets the form, calls `resetExercises()` on the store, toasts, and redirects to `/workouts`.

### Concrete UX friction

- **N+1 modal round-trips per workout**: for a workout with 4 exercises, the user opens/fills/submits the exercise dialog 4 separate times, then fills a 5th, different form (name + date) to actually persist anything. Nothing is saved to the server until the very last step — if the user abandons the page after adding exercises, everything in `useWorkoutStore` is lost (no persistence, no `localStorage`).
- **State handoff via two different mechanisms**: Form #1 writes to Zustand; the summary view *also* writes to Zustand directly (bypassing any form/schema) via `updateSet`; Form #2 *reads* Zustand into its `defaultValues` once (`listExercises: exerciseList` at mount) and then must be manually resynced via the submit-button `onClick` side effect described above, because `react-hook-form` defaultValues don't auto-track store changes.
- **Duplicated/overlapping schema surface**: `AddExerciseFormSchema` (per-exercise) is embedded inside `AddWorkoutFormSchema.listExercises` in `SummaryWorkoutForm.tsx`, but the top-level form never actually validates through it in the normal flow, since `listExercises` is force-set outside `handleSubmit`.
- **Tag derivation duplicated and inconsistent**: `createWorkout` (`src/actions/workout/create-workout.ts`) computes `tag` itself server-side from `nameWorkout` (`name-workout-<ISO date>`), similar in spirit to but differently shaped from the per-user tag derivation pattern established for exercises (`createExercise`, see `sdd/exercise-unique-tag-constraint`). No uniqueness constraint or race concern here (workout tags include a timestamp), just an inconsistent convention worth flagging.
- **Minor state bug spotted in passing**: `workout-store.ts` `addExercise` has a redundant/dead first branch (`if (exercises.length === 0) set({exercises:[exercise]})` immediately followed by an unconditional `set({exercises:[...exercises, exercise]})` using the pre-set closure value) — harmless today (both branches converge to the same result) but worth cleaning up if this file is touched.

## What "combine both forms" plausibly means

Two real candidate readings, not mutually exclusive:

- **(A) Merge Form #2 into Form #1's surface** — collect workout name + date once, up front or alongside the exercise list, instead of as a disconnected final step the user reaches only after finishing all exercises.
- **(B) Merge the dialog-per-exercise pattern into the main page form** — replace the repeated "open dialog → fill → submit → close" cycle with inline, always-visible exercise rows (e.g., an expandable list on the page itself), so exercise entry and the final "save workout" become one continuous form/submission instead of N dialog submissions + 1 page-level submission.

Given the Notion note explicitly says "combine both forms" (singular "both", not "all N dialogs"), reading (A) — unifying the *workout-level* form (name/date) with the *exercise-entry* surface into one coherent flow — is the more literal target, but the dialog-per-exercise repetition (B) is the larger actual friction source and likely can't be meaningfully fixed without also touching it.

## Candidate Approaches

1. **Single multi-section page form** (no dialog): one `react-hook-form` instance with `useFieldArray` for exercises, name/date fields always visible at top or bottom, exercises added inline (expand a new blank exercise section) instead of via `Dialog`. One `handleSubmit` call submits everything atomically to `createWorkout`.
   - Pros: single source of truth (no Zustand↔RHF sync bugs), single validation pass, aligns with `AddWorkoutFormSchema` already nesting `listExercises: AddExerciseFormSchema[]`.
   - Cons: larger form re-render surface; existing inline-edit UX in `SummaryWorkout` (`EditableStat`) would need rethinking or replacing with standard form fields; more invasive change (touches `workout-store.ts` usage across the whole create flow, `AddExerciseForm`, `SummaryWorkout`, `SummaryWorkoutForm`, and `create-workout.ts`'s expected shape).

2. **Wizard/stepper** (Step 1: name + date → Step 2..N: one exercise per step, "add another" advances a step → final review + submit): keeps per-exercise dialogs' focused UX but removes the disconnected final form by making name/date the *first* step instead of last.
   - Pros: smaller behavioral change per step (still one thing at a time, matches current mental model), name/date collected early so users don't lose everything if they abandon after step 1.
   - Cons: still N+1 total steps; still needs a persisted draft (store or step state) across steps; more UI chrome (progress indicator) to build.

3. **Keep the dialog, move name/date to the top of the page (outside the dialog), submit-on-page instead of submit-in-dialog** (minimal change): relocate `nameWorkout`/`dateWorkout` fields to the top of `CreateWorkoutPage` (or a shared header form), collected once before the user starts adding exercises; the exercise dialog stays as-is for adding sets; a single page-level "Guardar entrenamiento" button (already effectively `SummaryWorkoutForm`'s button) submits everything.
   - Pros: smallest diff — no `useFieldArray` rewrite, no dialog removal, mostly a relocation + the existing Zustand-based `exercises` list already accumulates correctly; directly resolves reading (A) with minimal risk.
   - Cons: doesn't address the N-dialog-round-trips friction (B) at all; the sync bug between Zustand and `listExercises` defaultValues would need an actual fix (e.g., `form.setValue` via `useEffect` watching the store, not just the submit-button `onClick` hack) rather than staying as a “relocate but keep hack” change.

## Open Product Questions (need a human decision before `sdd-propose`)

1. **Scope**: is the target strictly "merge the workout-name/date form into the exercise-adding screen" (reading A, approach 3), or does "combine forms" also mean removing the per-exercise dialog round-trip (reading B, approaches 1–2)? This changes the size of the change from a small relocation to a structural rewrite of the create-workout flow.
2. **Persistence across steps/exercises**: should in-progress workout data (exercises added but not yet saved) survive a page refresh or navigation away (e.g., via `localStorage`-backed Zustand persist middleware), given today it's fully lost? Not explicitly requested but directly related to "why does this feel disjointed."
3. **Mobile vs desktop layout**: `AddExerciseForm`'s Combobox + set stepper UI was designed for a dialog's constrained width; if forms 1 and 2 merge into one continuous page (approach 1), does the exercise-entry UI need a different (e.g., accordion/inline) layout on mobile vs the current dialog?
4. **Existing inline-edit UX in `SummaryWorkout`** (`EditableStat` for weight/reps after adding): if approach 1 (single form with `useFieldArray`) is chosen, should post-add editing become standard form fields (losing the "tap to edit" interaction) or should `EditableStat` be kept and just wired to `useFieldArray`'s `update()` instead of the Zustand store?
5. **Should the dead-code branch in `workout-store.ts`'s `addExercise` be cleaned up** as part of this change (touches the same file) or logged separately as Housekeeping? (Low risk either way; flagging per project convention that "small" changes still need to go through SDD or be logged as Housekeeping first.)

## Next Recommended

`sdd-propose` is premature until Q1 (scope) is answered — it fully determines whether this is a small relocation (approach 3) or a structural rewrite (approach 1 or 2). Given Prioridad: Baja and the ambiguity, recommend surfacing Q1–Q5 to the user as one grouped decision before proposing, rather than spending an `sdd-research` cycle (there's no external/library evidence to gather here — this is a pure internal UX/architecture decision).
