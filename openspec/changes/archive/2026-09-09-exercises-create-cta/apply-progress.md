# Apply Progress: Exercises Create CTA with Muscle-Group Pre-scoping

## Mode

Strict TDD (Vitest Stage 1, pure-logic units only).

## Per-Task Outcome

| Task | Outcome | Note |
|---|---|---|
| 1.1 RED | ✓ | Added two unit tests for `selectedMuscleGroup`; both failed as expected before implementation. |
| 1.2 GREEN | ✓ | Added `selectedMuscleGroup` to `useExercisesStore`; set in `filterExercises`; `setExercises` untouched. |
| 1.3 Gate | ✓ | `pnpm test` passed (54/54). |
| 2.1 CTA href | ✓ | `ExerciseSection` reads `selectedMuscleGroup` and computes `createHref`. |
| 2.2 Always-visible CTA | ✓ | `<Button asChild><Link href={createHref}>Crear ejercicio</Link></Button>` added above `FilterExercises`. |
| 2.3 Empty-state link | ✓ | Existing "Ánimate a crear uno" `<Link>` now uses `createHref`; copy unchanged. |
| 2.4 Gate | ✓ | `tsc`, `lint`, `format:check` passed. |
| 3.1 Form prop | ✓ | `CreateExerciseForm` accepts `defaultMuscleGroup?: string` and seeds RHF `defaultValues`. |
| 3.2 RSC validation | ✓ | `create/page.tsx` awaits async `searchParams`, validates tag against `getMuscleGroups()`, passes only known tags. |
| 3.3 Gate | ✓ | `tsc`, `lint`, `format:check`, `build` passed. |
| 4.1 Final gates | ✓ | All gates passed (see table below). |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `src/store/exercises/exercises-store.test.ts` | Unit | ✓ 3/3 | ✓ Written (2 failing) | N/A (RED only) | ✓ 2 cases (`all`, `chest`) | N/A |
| 1.2 | `src/store/exercises/exercises-store.test.ts` | Unit | ✓ 3/3 | N/A (tests already written) | ✓ Passed (5/5) | N/A (already triangulated) | ✓ Clean: single field assignment in both branches |

### Test Summary

- **Total tests written**: 2
- **Total tests passing**: 54 (full suite)
- **Layers used**: Unit (54)
- **Approval tests**: None — no refactoring tasks
- **Pure functions created**: 0 (state change in Zustand store)

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `CI=true pnpm vitest run src/store/exercises/exercises-store.test.ts` → `Test Files 1 passed (1) / Tests 5 passed (5)` |
| Runtime harness command/scenario and exact result | `CI=true pnpm build` → compiled successfully; `/exercises/create` rendered as dynamic route (240 B). `CI=true pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`, `pnpm exec prisma validate` all passed. |
| Rollback boundary | Revert the single commit containing: `src/store/exercises/exercises-store.ts`, `src/store/exercises/exercises-store.test.ts`, `src/app/(routes)/exercises/components/ExerciseSection.tsx`, `src/app/(routes)/exercises/create/page.tsx`, `src/components/exercise/CreateExerciseForm.tsx`, and the SDD `tasks.md`/`apply-progress.md` updates. No DB migration or external state. |

## Gate Results

| Gate | Command | Result |
|---|---|---|
| Tests | `CI=true pnpm test` | passed (54/54 tests, 8 files) |
| Type check | `CI=true pnpm exec tsc --noEmit` | passed (no output) |
| Linter | `CI=true pnpm lint` | passed (no ESLint warnings or errors) |
| Formatter | `CI=true pnpm run format:check` | passed (all files use Prettier style) |
| Schema validation | `CI=true pnpm exec prisma validate` | passed (schema valid) |
| Build | `CI=true pnpm build` | passed (compiled successfully; pre-existing `/workouts/create` dynamic-server warning unrelated to this change) |

## Deviations from Design

None — implementation matches design.

## Issues Found

- `pnpm build` emits a pre-existing `Dynamic server usage: Route /workouts/create` warning. It is unrelated to `exercises-create-cta` and does not fail the build.

## Workload / PR Boundary

- Mode: single PR
- Current work unit: exercises-create-cta (full change)
- Boundary: store + test, client CTA, RSC pre-scoping, final gates
- Estimated review budget impact: ~102 added / ~12 deleted lines across 6 source files (well under 400-line budget)

## Status

10/10 tasks complete. Ready for `sdd-verify`.
