## Exploration: Exercises create CTA with muscle-group pre-scoping

### Current State

- `/exercises` (`src/app/(routes)/exercises/page.tsx`) is an RSC that fetches exercises + muscle groups and renders `ExerciseSection`.
- `ExerciseSection.tsx` (client) renders `FilterExercises`, then either the exercise list (each card has an "Editar" `<Button asChild>` → `/exercises/update/:id`) or an empty state whose copy embeds the only creation link: "Ánimate a crear uno" → `/exercises/create`.
- **There is no creation CTA when the list is non-empty** — users with existing exercises have no visible path to create.
- `FilterExercises.tsx` (client) uses RHF + Zod. The `Select` stores the chosen muscle group by `tag` (plus `"all"` = Todos). The chosen value lives ONLY in the form; on submit it calls `useExercisesStore.filterExercises(muscleGroup)`.
- `useExercisesStore` (`src/store/exercises/exercises-store.ts`) keeps `exercises`, `filteredExercises`, `setExercises`, `filterExercises`. It does NOT persist the selected filter value — only its result. Unit tests exist (`exercises-store.test.ts`), which is the Stage-1 TDD surface.
- `/exercises/create` (`page.tsx`) is an RSC that fetches muscle groups and renders `CreateExerciseForm`. It does not read `searchParams`; the form hardcodes `defaultValues.muscleGroup = ""`. No pre-scoping exists.
- `createExercise` action imports the form's inferred type but does no runtime Zod `.parse()` (existing gap, out of scope).
- Next 15: `searchParams` is an async `Promise` in RSCs; precedent for async props exists in `update/[id]/page.tsx`.

### Affected Areas

- `src/store/exercises/exercises-store.ts` — add `selectedMuscleGroup` state so the active filter is readable outside the form.
- `src/store/exercises/exercises-store.test.ts` — cover new state behavior (Stage-1 TDD).
- `src/app/(routes)/exercises/components/ExerciseSection.tsx` — always-visible CTA + param-aware empty-state link.
- `src/app/(routes)/exercises/create/page.tsx` — read + validate `searchParams.muscleGroup`.
- `src/components/exercise/CreateExerciseForm.tsx` — accept `defaultMuscleGroup`, seed form defaults.

### Approaches

1. **Store the active filter in the Zustand store (recommended)** — add `selectedMuscleGroup` to `useExercisesStore`, set it inside `filterExercises`; `ExerciseSection` builds hrefs from it.
   - Pros: minimal churn; single source of truth for "the filter that produced the current list"; unit-testable under Stage 1; works for both CTAs.
   - Cons: store gains one field.
   - Effort: Low

2. **Lift filter state to `ExerciseSection` (controlled props)** — `useState` in the section, pass value/onChange into `FilterExercises`.
   - Pros: no store change.
   - Cons: refactors `FilterExercises` API, duplicates store logic, more churn for the same outcome.
   - Effort: Medium

3. **Read form value via ref/imperative handle** — expose the RHF value from `FilterExercises`.
   - Pros: none meaningful.
   - Cons: breaks the sibling-component boundary; not testable; rejected.

### Recommendation

Approach 1: persist `selectedMuscleGroup` in the store (`""` or `"all"` = no filter), and derive hrefs in `ExerciseSection`. On the create side, await `searchParams` (Next 15 async), validate the tag against the fetched muscle-group list server-side (ignore unknown tags — a bogus param must never become a submitted `muscleGroupTag`), and pass `defaultMuscleGroup` to `CreateExerciseForm` to seed `defaultValues`.

### Risks

- User-controllable query param: validate against muscle list before prefill, else an invalid tag can be submitted as `muscleGroupTag` (Radix Select would show a placeholder while RHF holds the bogus value).
- Select draft value vs last-submitted filter can diverge; the store value (last submitted) is the correct semantic because it is what produced the visible (empty) list.

### Ready for Proposal

Yes — scope is small, single-file surface, no schema/migration impact, and the strict-TDD surface (store test) is clear.