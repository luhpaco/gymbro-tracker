# Apply Progress: Exercise Create Zod Validation

## Status

All tasks complete. Ready for `sdd-verify`.

## Per-Task Outcomes

| Task | Outcome | Notes |
|------|---------|-------|
| 1.1 RED — `src/lib/schemas/exercise.test.ts` | ✓ | 4 vitest cases written; `pnpm test src/lib/schemas/exercise.test.ts` failed RED with `Cannot find module './exercise'`. |
| 1.2 GREEN — `src/lib/schemas/exercise.ts` | ✓ | Schema created with `name` min 4, `description?`, `muscleGroupTag` min 1, Spanish messages; focused test passed 4/4. |
| 1.3 Type-check schema | ✓ | `pnpm exec tsc --noEmit` passed. |
| 2.1 Rewrite `src/actions/exercise/create-exercise.ts` | ✓ | Discriminated-union return; auth → safeParse → muscle-group findUnique → derive tag → per-user findFirst → create → revalidatePath. No `console.error`, no `return undefined`. |
| 2.2 Type-check action union | ✓ | `pnpm exec tsc --noEmit` passed. |
| 3.1 Update `CreateExerciseForm.tsx` | ✓ | Kept RHF field names; mapped on submit; switched on `result.ok`; code-specific Spanish destructive toasts. |
| 3.2 Type-check / lint / format | ✓ | All passed after Prettier write. |
| 4.1 Final gates | ✓ | `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`, `pnpm exec prisma validate`, `pnpm build` all passed. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/lib/schemas/exercise.test.ts` | Unit | ✅ 54/54 baseline | ✅ Written (import fails) | ✅ 4/4 passed | ✅ 4 cases covering accept + 3 reject paths | ✅ Prettier formatted |
| 1.2 | `src/lib/schemas/exercise.test.ts` | Unit | N/A (new file) | ✅ Referenced missing schema | ✅ 4/4 passed | ✅ 4 cases force real schema logic | ✅ Prettier formatted |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command | `pnpm test src/lib/schemas/exercise.test.ts` → 4/4 passed |
| Full test command | `pnpm test` → 9 files, 58/58 passed (was 54/54 baseline) |
| Runtime harness | Manual smoke recommended via dev server for action/form branches; no automated runtime harness exists at Stage 1 |
| Rollback boundary | Revert `src/lib/schemas/exercise.ts`, `src/lib/schemas/exercise.test.ts`, `src/actions/exercise/create-exercise.ts`, `src/components/exercise/CreateExerciseForm.tsx`; no migration |

## Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Test | `pnpm test` | passed (58/58, 9 files) |
| Type check | `pnpm exec tsc --noEmit` | passed |
| Lint | `pnpm lint` | passed |
| Format | `pnpm run format:check` | passed |
| Prisma validate | `pnpm exec prisma validate` | passed |
| Build | `pnpm build` | passed (exit code 0) |

## Notes

- Build emits a pre-existing `Dynamic server usage: Route /workouts/create` warning during static generation; the route is marked dynamic and the build exits 0. This is unrelated to the exercise-create change.
- No deviations from `design.md` or `spec.md`.
- Workload remained within the ~110-line forecast; final diff is a single PR.

## Focused Remediation — 2026-09-11

### Status

The original tasks remain complete. The authorized remediation is complete and requires independent `sdd-verify` before archive consideration.

### Remediation Outcome

`createExercise` now keeps the muscle-group lookup, per-user tag lookup, and exercise creation in one error boundary after authentication and `safeParse`. Any failure from those Prisma operations returns `{ ok: false, code: "error" }`; successful creation remains the only path that calls `revalidatePath("/exercises")`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| Remediation: Prisma error boundary | `src/actions/exercise/create-exercise.test.ts` | Unit | `CI=true pnpm test` → 58/58 passed | Two lookup-rejection cases failed because the action rejected instead of returning the error union | `CI=true pnpm test src/actions/exercise/create-exercise.test.ts` → 3/3 passed | Three distinct Prisma failures (muscle-group lookup, tag lookup, create) return the same public error union | Moved only the existing pre-check flow into the existing catch block; no behavior or error-code changes |

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `CI=true pnpm test src/actions/exercise/create-exercise.test.ts` → 1 file, 3/3 passed |
| Runtime harness command/scenario and exact result | Vitest invokes the server action with mocked Prisma failures for each of its three Prisma operations; `CI=true pnpm test src/actions/exercise/create-exercise.test.ts` → all scenarios returned `{ ok: false, code: "error" }` |
| Rollback boundary | Revert `src/actions/exercise/create-exercise.ts` and `src/actions/exercise/create-exercise.test.ts`; no schema, form, database, or cache behavior beyond the existing action contract changes |

### Remediation Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Focused action test | `CI=true pnpm test src/actions/exercise/create-exercise.test.ts` | passed (3/3) |
| Test | `CI=true pnpm test` | passed (61/61, 10 files) |
| Type check | `CI=true pnpm exec tsc --noEmit` | passed |
| Lint | `CI=true pnpm lint` | passed |
| Format | `CI=true pnpm run format:check` | known environmental failure (exit 123): deleted tracked paths `openspec/changes/exercises-create-cta/apply-progress.md` and `openspec/changes/exercises-create-cta/tasks.md` are enumerated by the formatter; all matched files are formatted |

### Remediation Notes

- No schema, form, OpenSpec configuration, archive artifact, or Notion content was changed.
- The current Node 22.22.2 runtime does not satisfy the package's Node 24.x engine declaration; the recorded commands still completed as shown.
