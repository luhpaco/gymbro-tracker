# Tasks: Exercise Create Zod Validation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~110 (4 files: 2 new, 2 modified) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Schema + action union + form branches | `pnpm test` | Manual smoke: submit valid/invalid via dev server | Revert 4 files; no migration |

## Phase 1: Shared Schema + Tests (Stage-1 TDD)

- [x] 1.1 RED — Create `src/lib/schemas/exercise.test.ts`: 4 vitest cases (accept valid input, reject `name` < 4 chars, reject empty `muscleGroupTag`, reject missing `name`). Run `pnpm test`, confirm RED. Covers: Valid input parses, Name too short, Empty muscle-group tag, Missing required field.
- [x] 1.2 GREEN — Create `src/lib/schemas/exercise.ts` exporting `createExerciseSchema` (`name` min 4, `description?`, `muscleGroupTag` min 1; Spanish messages) and inferred `CreateExerciseInput`. No `tag` field. Run `pnpm test`, confirm GREEN.
- [x] 1.3 Run `pnpm exec tsc --noEmit` to confirm inferred type compiles.

## Phase 2: Server Action (Return-Shape Change)

- [x] 2.1 Rewrite `src/actions/exercise/create-exercise.ts`: signature → `(input: CreateExerciseInput)`. Flow: auth → `safeParse` → muscle-group `findUnique` → derive `tag` → per-user `findFirst` → `create` → `revalidatePath("/exercises")` → `{ ok: true, exercise }`. Each failure returns `{ ok: false, code }` with codes: `unauthorized`, `invalid_input`, `unknown_muscle_group`, `duplicate_tag`, `error` (catch-all). Remove `console.error` + `return undefined`. Mirror `src/actions/workout/update-set.ts` (read-only). Covers: Discriminated-union return (all 6 scenarios), Runtime parse, Muscle-group pre-check, Tag uniqueness pre-check.
- [x] 2.2 Run `pnpm exec tsc --noEmit` to confirm union return type.

## Phase 3: Form (Branch Handling + Field Mapping)

- [x] 3.1 Modify `src/components/exercise/CreateExerciseForm.tsx`: keep RHF field names + local resolver. In `onSubmit`, map `{ exerciseName → name, muscleGroup → muscleGroupTag }`. Switch on `result.ok`: `true` → success toast + reset + push `/exercises`. `false` → destructive toast per code (messages from design.md §D5). Remove `catch` block. Covers: Success branch, Error branch per code, Field mapping on submit.
- [x] 3.2 Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`.

## Phase 4: Final Gates

- [x] 4.1 Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`, `pnpm exec prisma validate`, `pnpm build`. ALL must pass.
