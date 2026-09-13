# Archive Report: exercise-unique-tag-constraint

## Change Summary

Atomic per-user exercise tag uniqueness via a Prisma composite unique constraint on `Exercise (userId, tag)`, closing the check-to-create race window. Caught Prisma P2002 errors are mapped by target: composite constraint → `duplicate_tag`, other targets → `error`.

## Final State (at close)

- **Apply**: Commits `b96906c` (schema + migration `20260913205125_exercise_user_tag_unique`) and `8f3c7da` (helper + 2 tests). Duplicate gate: 0 violating rows. All 17 tasks complete.
- **Verify**: PASS WITH WARNINGS. 13/13 scenarios (5 requirements), 86/86 tests. Six gates green.
- **Warnings (accepted at archive)**:
  1. True-concurrency race not runtime-exercised — the composite constraint is the atomic proof via apply-time live-DB probe.
  2. Spec catch-all wording ambiguity — tightened during archive: "Error catch-all" scenario now reads "a non-composite P2002 or other DB error during create → `error`".
- **CRITICAL issues**: None.

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| proposal.md | `archive/2026-09-13-exercise-unique-tag-constraint/proposal.md` | Archived |
| specs/exercise-tag-uniqueness/spec.md | `openspec/specs/exercise-tag-uniqueness/spec.md` | Promoted (new) |
| specs/exercise-action-validation/spec.md | `openspec/specs/exercise-action-validation/spec.md` | Composed (delta merged) |
| design.md | `archive/2026-09-13-exercise-unique-tag-constraint/design.md` | Archived |
| tasks.md | `archive/2026-09-13-exercise-unique-tag-constraint/tasks.md` | Archived (17/17 [x]) |
| verify-report.md | `archive/2026-09-13-exercise-unique-tag-constraint/verify-report.md` | Archived |
| exploration.md | `archive/2026-09-13-exercise-unique-tag-constraint/exploration.md` | Archived |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| exercise-tag-uniqueness | Created (promoted) | 4 requirements, 6 scenarios — new source-of-truth spec |
| exercise-action-validation | Updated (composed) | MODIFIED "Per-user tag uniqueness pre-check": added atomic concurrency reference, 3 new scenarios (concurrent insert races, composite P2002 target, non-composite P2002 target). Existing requirements preserved unchanged. |

## Mechanical Copy Evidence

- **exercise-tag-uniqueness promotion**: `diff -r` — empty (no differences). PASS.
- **exercise-action-validation composition**: `gentle-ai sdd-archive-compose` — zero exit. Atomic `.compose-tmp` + `mv`.
- **archive move**: `git mv` failed (empty source from pre-staging), fallback `mv` succeeded. `diff -r snapshot source vs destination` — empty. PASS.

## Commits

| Commit | Description |
|--------|-------------|
| `b96906c` | Schema `@@unique([userId, tag])` + migration `20260913205125_exercise_user_tag_unique` |
| `8f3c7da` | `isCompositeTagViolation` helper + 2 new tests |

## Residual Risks

1. **True-concurrency race not runtime-exercised** — Stage 1 Vitest mocks cannot reproduce concurrent DB writes. The composite unique constraint itself is the atomic proof; the risk is theoretical only under current test infrastructure. Acceptable at archive time per orchestrator approval.
2. **Spec catch-all wording** — The "Error catch-all" scenario under Discriminated-union return now reads "a non-composite P2002 or other DB error during create → `error`" (tightened during this archive to resolve the sdd-spec flag).

## Follow-ups

- None required. The change is complete.
- Future enhancement: Stage 3 Postgres-integration tests could exercise true-concurrency scenarios against a real service container.

## Traceability

- **Engram topic**: `sdd/exercise-unique-tag-constraint/archive-report`
- **Engram project**: `gymbro-tracker`
