# Exploration: Exercise Soft-Delete (active/inactive state)

## Current State

- `Exercise` model (`prisma/schema.prisma`) has `id`, `name @unique`, `tag`, `description?`, `muscleGroupTag` FK, `userId` FK, `sets Set[]`. **No boolean fields exist anywhere in the schema** — `isActive Boolean @default(true)` introduces the first Boolean; the `@default(...)` convention matches `Role @default(USER)`.
- `getExercises` (`src/actions/exercise/get-exercises.ts`): auth check, then `findMany({ where: { userId } })` returning ALL exercises. Consumers: `/exercises` page AND `/workouts/create` page — active-only filtering affects both (desired: inactive exercises must not be addable to workouts).
- `getExercisesSummary` (`src/actions/exercise/get-exercises-summary.ts`): `findMany` with take/skip/orderBy sets-count, filtered by `userId` only. Consumer: `/dashboard`.
- `exercises-store` (`src/store/exercises/exercises-store.ts`): holds `Exercise[]`; `setExercises` mirrors into `filteredExercises` (re-applying the active muscle filter). The store filters by `muscleGroupTag` only — active-only filtering belongs upstream in the server actions, not the store. Store test fixture `makeExercise` builds full `Exercise` rows and will need `isActive` once the Prisma type gains the field (strict TS compile).
- Action precedents: `create-exercise.ts` = auth → Zod `safeParse` → pre-checks → Prisma → coded discriminated union (`{ ok: true, exercise } | { ok: false, code }`). `update-set.ts` = auth → Zod → ownership via `findFirst` with nested `userId` match → update → `{ ok: true/false as const }`.
- UI: `ExerciseSection.tsx` renders a `TornStrip` per exercise with an `Editar` `Button asChild`/`Link`. No exercise delete control exists; closest precedent is `SummaryWorkout.tsx` (destructive icon button, client-draft removal only, not DB). Toasts use `useToast` from `@/components/ui/use-toast` (Radix), Spanish messages.
- Specs: `exercise-creation` (CTA/filter/prescoping) and `exercise-action-validation` (createExercise schema/union) — neither collides with a new soft-delete capability.

## Affected Areas

- `prisma/schema.prisma` — add `isActive Boolean @default(true)` to `Exercise`
- `prisma/migrations/*_exercise_is_active/` — new migration via `prisma migrate dev`
- `src/actions/exercise/get-exercises.ts` — add `isActive: true` to `where`
- `src/actions/exercise/get-exercises-summary.ts` — add `isActive: true` to `where`
- `src/actions/exercise/set-exercise-active-state.ts` (new) — toggle action
- `src/lib/schemas/exercise.ts` — add `exerciseActiveStateSchema` (unit-testable)
- `src/app/(routes)/exercises/components/ExerciseSection.tsx` — deactivate control
- `src/store/exercises/exercises-store.test.ts` — fixture gains `isActive`
- `src/app/(routes)/workouts/create/page.tsx` — indirect consumer of `getExercises` (verified behavior, no code change)

## Approaches

1. **Server-side flag + toggle action (recommended)** — `isActive @default(true)` on `Exercise`; both read actions filter `isActive: true`; one action `setExerciseActiveState({ id, isActive })` handles deactivate AND reactivate (same boolean flip); deactivate `Button` in `ExerciseSection`; `revalidatePath("/exercises")` + `router.refresh()` after success.
   - Pros: minimal surface; migration-safe (`@default(true)` keeps all existing rows active); `Set` FK untouched (no orphan, no cascade); reactivation server-side is trivial and future-proof; coded union gives the UI branchable feedback; matches newest codebase conventions.
   - Cons: soft-deleted exercises still occupy the global `name @unique` (same-name re-creation blocked until reactivated); requires a migration; stale card if client does not refresh.
   - Effort: Medium

2. **Hard delete** — remove the row; requires handling `Set` FK (no cascade today → delete fails with referential integrity, or cascade = destructive).
   - Pros: frees the unique `name`.
   - Cons: destroys workout history; destructive; explicitly out of scope; needs FK/cascade changes.
   - Effort: Low-Medium (rejected)

3. **Separate `deactivateExercise` + `reactivateExercise` actions** — two files instead of one toggle.
   - Pros: explicit per-direction contract.
   - Cons: duplicated auth/Zod/ownership boilerplate; the toggle's extra branch is one boolean.
   - Effort: Low-Medium

## Recommendation

Approach 1. Server-side reactivation is included (it is the same `isActive: false → true` flip in one action, zero extra UI cost); only the reactivation UI control is deferred. Store keeps no active-filter logic — server actions own it.

## Risks

- Migration on existing rows: `@default(true)` backfills all rows active — low.
- Orphaned `Set` references: none — FK untouched, no cascade; deactivated exercises stay in historical workout data — documented decision.
- Soft-deleted name blocks re-creation: global `name @unique` still held — mitigated by server-side reactivation; uniqueness change out of scope.
- Store filter semantics: store receives server-filtered lists; `setExercises` re-apply-filter already handles fresh payloads; stale card mitigated by `revalidatePath` + `router.refresh()`.
- Direct update URL (`/exercises/update/[id]`) can still edit a soft-deleted exercise — accepted edge, out of scope, noted for verification.
- Shared read path: active-only filter in `getExercises` also changes `/workouts/create` behavior (inactive exercises no longer selectable) — desired, verify explicitly.

## Ready for Proposal

Yes — scope is confirmed; the orchestrator should tell the user: `isActive` field name confirmed (no conflicting boolean convention), reactivation included server-side but its UI deferred, and `getExercises` active-filter also affects the workout-creation picker (desired).