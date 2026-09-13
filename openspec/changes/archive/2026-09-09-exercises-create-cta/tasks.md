# Tasks: Exercises Create CTA with Muscle-Group Pre-scoping

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed files | 5 |
| Estimated changed lines | 120–180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Store + Tests (Stage-1 TDD surface)

- [x] 1.1 RED — extend `src/store/exercises/exercises-store.test.ts` with two cases: (a) `filterExercises('all')` asserts `selectedMuscleGroup === 'all'` and full list; (b) `filterExercises('chest')` asserts `selectedMuscleGroup === 'chest'` and only chest exercises. Covers Filter-Driven Param Derivation › draft-vs-submitted (the field is only set on submit, not on draft change).
- [x] 1.2 GREEN — in `src/store/exercises/exercises-store.ts`, add `selectedMuscleGroup: string` to state (init `""`); inside `filterExercises`, also `set({ selectedMuscleGroup: muscle })`. `setExercises` left untouched.
- [x] 1.3 Run `pnpm test` — must pass before moving on.

## Phase 2: Client Component (CTA + empty-state link)

- [x] 2.1 In `src/app/(routes)/exercises/components/ExerciseSection.tsx`, read `selectedMuscleGroup` from `useExercisesStore`; compute `createHref = selectedMuscleGroup && selectedMuscleGroup !== 'all' ? \`/exercises/create?muscleGroup=${selectedMuscleGroup}\` : '/exercises/create'`.
- [x] 2.2 Add an always-visible "Crear ejercicio" `<Button asChild><Link href={createHref}>` at the section header. Covers Always-Visible CTA › populated list / empty unfiltered list / carries active filter.
- [x] 2.3 Make the existing empty-state "Ánimate a crear uno" `<Link>` use the same `createHref` expression. Covers Empty-state link › reflects active filter / without a filter.
- [x] 2.4 Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`.

## Phase 3: RSC Pre-scoping

- [x] 3.1 In `src/components/exercise/CreateExerciseForm.tsx`, add optional prop `defaultMuscleGroup?: string`; seed `useForm({ defaultValues: { ..., muscleGroup: defaultMuscleGroup ?? "" } })`. No other change. Covers Valid tag pre-scopes the form.
- [x] 3.2 In `src/app/(routes)/exercises/create/page.tsx`, `await searchParams`; read `muscleGroup`; fetch `getMuscleGroups()`; if the tag matches a known muscle group `tag`, pass `defaultMuscleGroup={tag}` to `CreateExerciseForm`; otherwise pass nothing. Covers Unknown tag is ignored / No parameter leaves the form un-scoped.
- [x] 3.3 Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`, `pnpm build`.

## Phase 4: Final Gates

- [x] 4.1 Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`, `pnpm exec prisma validate`, `pnpm build`. All must pass.
