# Proposal: Exercises Create CTA with Muscle-Group Pre-scoping

## Intent

On `/exercises`, the only creation path is a link inside the empty-state copy, so users with existing exercises see no CTA. An active filter producing an empty list also drops context on "Ánimate a crear uno". This change adds an always-visible "Crear ejercicio" button and pre-scopes the create form to the active muscle group.

## Scope

### In Scope

- Always-visible "Crear ejercicio" CTA on `/exercises`, routed to `/exercises/create`, using existing `<Button asChild>` style.
- New `selectedMuscleGroup` in `useExercisesStore`, set by `filterExercises`, + unit tests.
- Empty-state "Ánimate a crear uno" link appends `?muscleGroup=<tag>` when a non-`"all"` filter produced the empty list; no param otherwise.
- Always-visible CTA sends the param when a filter is active.
- `/exercises/create` reads `searchParams.muscleGroup`, validates the tag against the muscle-group list, pre-scopes `CreateExerciseForm` via new `defaultMuscleGroup` prop.

### Out of Scope

- Runtime Zod validation in `createExercise` action (existing gap — flagged, not fixed).
- Filter persistence across navigation (URL sync, localStorage).
- Update/delete CTAs or other pages.

## Capabilities

### New Capabilities

- `exercise-creation`: create-exercise entry points (always-visible CTA) and pre-scoping via a validated `muscleGroup` query param.

### Modified Capabilities

- None

## Approach

Add `selectedMuscleGroup` to `useExercisesStore` (set in `filterExercises`; `""`/`"all"` = no filter). `ExerciseSection` builds hrefs from it: active filter → `?muscleGroup=<tag>`, none → bare `/exercises/create`. Create page awaits `searchParams` (Next 15 async), validates the tag against `getMuscleGroups()`, passes `defaultMuscleGroup` to `CreateExerciseForm` (seeds `defaultValues`); unknown tags ignored.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/store/exercises/exercises-store.ts` | Modified | Add `selectedMuscleGroup`; set in `filterExercises` |
| `src/store/exercises/exercises-store.test.ts` | Modified | Tests for new state |
| `src/app/(routes)/exercises/components/ExerciseSection.tsx` | Modified | Always-visible CTA + param-aware empty-state link |
| `src/app/(routes)/exercises/create/page.tsx` | Modified | Validate `searchParams.muscleGroup`; pass `defaultMuscleGroup` |
| `src/components/exercise/CreateExerciseForm.tsx` | Modified | Accept `defaultMuscleGroup`; seed defaults |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bogus `?muscleGroup=` tag submitted as `muscleGroupTag` | Med | Validate tag against muscle list before prefill; ignore unknown |
| Select draft vs last-submitted filter diverge | Low | Use store value (last submitted) — it produced the visible list |

## Rollback Plan

Revert the single commit (store + test, `ExerciseSection`, create page, `CreateExerciseForm`). No DB migration or data risk.

## Dependencies

- None (no new packages).

## Success Criteria

- [ ] CTA visible on `/exercises` with and without exercises.
- [ ] Active-filter empty-state link opens the form pre-selected.
- [ ] No param (or `all`) opens the form un-scoped.
- [ ] Unknown tag in the URL is ignored.
- [ ] `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` pass.