# Proposal: Exercise Soft-Delete

## Intent

Users need to retire an exercise (Notion: "Add delete functionality"). Hard delete would cascade or orphan `Set` rows, so we add an `isActive` flag: inactive exercises leave lists and pickers while their `Set` history stays intact.

## Scope

### In Scope
- `isActive Boolean @default(true)` on `Exercise` + migration
- Active-only filters in `getExercises`, `getExercisesSummary`
- New `setExerciseActiveState` action (auth, Zod, ownership, coded union; deactivate + reactivate)
- Deactivate `Button` (destructive) in `ExerciseSection`
- Tests: `exerciseActiveStateSchema` units; store fixture gains `isActive`

### Out of Scope
- Hard delete, cascade changes, reactivation UI (server-side reactivation included; UI deferred), workout/set logic, other actions' Zod, unique-name changes

## Capabilities

### New Capabilities
- `exercise-soft-delete`: active/inactive lifecycle — schema flag, active-only read paths, toggle action, deactivate UI

### Modified Capabilities
- None — `exercise-creation` and `exercise-action-validation` unchanged

## Approach

Add `isActive @default(true)`, migrate. Filter `isActive: true` in both read actions (`getExercises` also feeds `/workouts/create` — desired). New `setExerciseActiveState({ id, isActive })` follows `update-set.ts` (auth → Zod → ownership `findFirst` → update) with a `create-exercise.ts`-style coded union. `ExerciseSection` gets a destructive deactivate button; on success, `revalidatePath("/exercises")` + `router.refresh()`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | `isActive` on `Exercise` |
| `prisma/migrations/*_exercise_is_active/` | New | Migration, default true |
| `src/actions/exercise/get-exercises.ts` | Modified | Where `isActive: true` |
| `src/actions/exercise/get-exercises-summary.ts` | Modified | Where `isActive: true` |
| `src/actions/exercise/set-exercise-active-state.ts` | New | Toggle action |
| `src/lib/schemas/exercise.ts` | Modified | `exerciseActiveStateSchema` |
| `src/app/(routes)/exercises/components/ExerciseSection.tsx` | Modified | Deactivate control |
| `src/store/exercises/exercises-store.test.ts` | Modified | Fixture gains `isActive` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration on existing rows | Low | `@default(true)` keeps all rows active |
| Orphaned `Set` references | Low | FK untouched, no cascade — documented decision |
| Stale card after deactivate | Low | `revalidatePath` + `router.refresh()` |
| Soft-deleted name blocks re-creation | Med | Global `name @unique`; reactivation server-side; out of scope |

## Rollback Plan

Additive migration, safe to revert: revert `schema.prisma`, generate a NEW migration dropping the column (never hand-edit generated SQL), or restore the pre-change snapshot. Deactivation flips a boolean — no data loss.

## Dependencies

- Prisma 5.18 + local PostgreSQL for `prisma migrate dev`

## Success Criteria

- [ ] Migration adds `isActive BOOLEAN NOT NULL DEFAULT true`; `prisma validate` passes; existing rows active
- [ ] `getExercises` and `getExercisesSummary` return only active exercises
- [ ] `setExerciseActiveState` rejects unauthenticated/non-owned/malformed input via coded union, no DB write
- [ ] Deactivating removes the card after refresh; `Set` rows intact
- [ ] `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit` pass