# Archive Report: exercises-create-cta

## Summary

Exercises page now has an always-visible "Crear ejercicio" CTA that navigates to `/exercises/create?muscleGroup=<tag>` when a muscle-group filter is active. The create form pre-scopes to the selected muscle group via a validated query parameter. Implementation completed 2026-09-09.

## Verification

| Gate | Verdict |
|------|---------|
| `pnpm test` | 54/54 pass |
| `pnpm exec tsc --noEmit` | pass |
| `pnpm lint` | pass |
| `pnpm run format:check` | pass |
| `pnpm exec prisma validate` | pass |
| `pnpm build` | pass |

Final-state facts (orchestrator-confirmed): `success`, commit `a7d1b70`. 10/10 tasks complete. 5 source files changed (+186/-12). Verify verdict: `pass_with_warnings` (8 of 9 scenarios typecheck-verified; 1 unit-tested; remaining deferred to Stage 2/3 E2E per design §5 — pre-agreed, not a regression).

## Spec Sync

| Domain | Action | Details |
|--------|--------|---------|
| exercise-creation | Created (promoted from delta) | 3 requirements (Always-Visible Exercise Creation CTA, Filter-Driven Param Derivation, Muscle-Group Pre-scoping of the Create Form), 7 scenarios total |

## Archive Contents

- `proposal.md` ✅
- `exploration.md` ✅
- `design.md` ✅
- `specs/exercise-creation/spec.md` ✅
- `tasks.md` ✅ (10/10 tasks complete)
- `verify-report.md` ✅
- `apply-progress.md` ✅

## Notion Sync

Both backlog tasks updated by orchestrator (NOT by archive sub-agent):
- `Add button for creating exercise from /exercises` — Status: Listo, Owner: OpenCode
- `After 'Ánimate a crear uno' → send param with muscle group` — Status: Listo, Owner: OpenCode

## Commits

| SHA | Description |
|-----|-------------|
| `a7d1b70` | Final implementation commit (all 10 tasks) |

## Residual Risks & Follow-Up Backlog Candidates

### 1. Runtime Zod validation in `createExercise` server action — separate backlog candidate

The `muscleGroup` query parameter is validated against known muscle groups in the RSC layer (page.tsx) and the form defaults it, but the `createExercise` server action does not enforce runtime Zod validation on the muscle group field. If a malformed request reaches the server action directly, no Zod guard rejects it.

**Recommendation**: Create a new backlog ticket (Tipo: Feature) to add a Zod schema to the `createExercise` server action validating `muscleGroup` against known tags.

### 2. Pre-existing typo: `mouscleGroups` in `FilterExercises` component

The `FilterExercises` component's prop is spelled `mouscleGroups` (missing 's' swap). This is a pre-existing typo, not introduced by this change. The sub-agent was instructed NOT to fix it.

**Recommendation**: Housekeeping ticket to rename `mouscleGroups` → `muscleGroups` in the component and its consumers.

## Engram Traceability

Archive report persisted to Engram at `sdd/exercises-create-cta/archive-report`.
