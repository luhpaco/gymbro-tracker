# Archive Report: exercise-reference-data-dynamic-render

**Change**: exercise-reference-data-dynamic-render
**Archived to**: `openspec/changes/archive/2026-08-20-exercise-reference-data-dynamic-render/`
**Archive Date**: 2026-08-20
**SDD Cycle Status**: Complete (planning, implementation, verification, and archival finished)

## Artifact Lineage (Engram Observation IDs)

- Proposal: id 158 | `sdd/exercise-reference-data-dynamic-render/proposal`
- Spec: id 160 | `sdd/exercise-reference-data-dynamic-render/spec`
- Design: id 163 | `sdd/exercise-reference-data-dynamic-render/design`
- Tasks: id 164 | `sdd/exercise-reference-data-dynamic-render/tasks`
- Verify Report: id 166 | `sdd/exercise-reference-data-dynamic-render/verify-report`

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `reference-data-delivery` | Created | New domain; delta spec copied to `openspec/specs/reference-data-delivery/spec.md` |

**Spec Sync Method**: Mechanical shell copy (`cp -R` + `diff -r` verification); empty diff confirms byte-identity integrity.

**Spec Content**: The `reference-data-delivery` spec defines request-time freshness guarantees for global, non-user-scoped reference data (e.g. muscle groups). One requirement with three scenarios:
- Selector reflects live database state
- Consuming route is classified as dynamic at build time
- Database unreachable at request time (pre-existing behavior, unchanged)

## Archive Contents

Archived to: `/home/luhpaco/projects/gymbro-tracker/openspec/changes/archive/2026-08-20-exercise-reference-data-dynamic-render/`

- `proposal.md` ✓
- `specs/reference-data-delivery/spec.md` ✓
- `design.md` ✓
- `tasks.md` ✓ (7/7 tasks complete)
- `apply-progress.md` ✓
- `verify-report.md` ✓
- `exploration.md` ✓

**Archive Move Method**: Mechanical shell move (`git mv` + `diff -r` verification); empty diff confirms byte-identity integrity. Source directory successfully removed.

## Task Completion

All implementation and verification tasks marked complete in persisted tasks artifact:

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Core Implementation | 1.1, 1.2, 1.3, 1.4 | 4/4 complete |
| Phase 2: Verification | 2.1, 2.2, 2.3 | 3/3 complete |
| **Total** | | **7/7 complete** |

Per tasks artifact (id 164):
- Task 2.3 (manual visual verification): Completed by orchestrator post-apply via `agent-browser` against local `pnpm dev` server; all 14 canonical MuscleGroup rows rendered in `/exercises/create` combobox (Pecho, Espalda, Hombros, Bíceps, Tríceps, Piernas, Glúteos, Abdominales, Trapecio, Antebrazo, Gemelos, Isquiotibiales, Cuádriceps, Deltoides).

## Verification Report Final State

Per verify-report (id 166), verdict: **PASS**

| Metric | Result |
|--------|--------|
| Blockers | 0 |
| Critical findings | 0 |
| Requirements compliant | 1/1 |
| Scenarios compliant | 3/3 |
| Build status | Passed (exit 0) |
| Type check status | Passed (zero output) |
| Lint status | Passed (zero errors, one pre-existing unrelated warning) |
| Test status | N/A (no test runner configured per project convention) |

**Route Dynamic Classification** (per spec compliance): `pnpm build` output confirms `/exercises/create` prefixed with `ƒ (Dynamic) server-rendered on demand`, meeting the "Consuming route is classified as dynamic at build time" scenario.

## Implementation Summary

**What was changed**: Added `await connection()` to `getMuscleGroups()` in `src/actions/muscle/get-muscle-groups.ts` to force per-request execution, preventing static prerendering from baking an empty array into served HTML.

**How much changed**: ~3 lines (1 import line + 1 `await connection()` statement, plus re-indent of existing try/catch body) — well under the 400-line review budget.

**Why this works** (per design id 163): `await connection()` sits outside the existing try/catch block (not nested inside), so the `DynamicServerError` Next.js throws on the legacy prerender path is not swallowed by the catch handler that was written for Prisma errors. Design explicitly verified that placement against the installed `next/dist/server/request/connection.js` and `next/dist/build/utils.js` internals.

## Delivery Status

**Code commit**: Merged into branch `fix/exercise-reference-data-dynamic-render` (commit `face7a8`); includes the code fix and this entire SDD change folder.

**PR Status**: GitHub PR #16 (https://github.com/luhpaco/gymbro-tracker/pull/16) targeting `master` is currently **OPEN** (not yet merged to main). Archive closure completes the SDD planning/implementation/verification cycle; merge to `master` is a subsequent delivery step outside the SDD workflow.

**Notion**: Related Notion ticket (https://app.notion.com/p/3c2b57b76c9b81ca9803eeabd9781e32) Status field remains to be updated by orchestrator post-archive.

## Source of Truth Updated

The following spec now reflects the new capability and implementation:

- `openspec/specs/reference-data-delivery/spec.md` — governs request-time freshness for global reference data, with three compliant scenarios

## SDD Cycle Complete

**Proposal**: Defined the production bug (frozen empty selector on `/exercises/create`), scope, and fix strategy (data-layer request-time freshness guarantee).

**Spec**: Formalized the freshness contract and three validating scenarios.

**Design**: Specified the exact technical approach (`await connection()` outside the try/catch) with architectural rationale and threat analysis.

**Tasks**: Listed 7 concrete steps (implementation + verification) and delivered review-budget forecast (Low risk, ~3 lines).

**Apply**: OpenCode implemented the 3-line fix, verified all tasks, created commit and PR.

**Verify**: Orchestrator re-ran build/lint/typecheck, manually tested the selector population via browser, confirmed spec compliance and design coherence.

**Archive**: Synced delta spec to main specs, moved change folder to archive, closed the cycle.

The change is fully planned, implemented, verified, and archived. Ready for the next change.

## Contradictions & Reconciliations

None. No contradictions between the orchestrator's final-state facts (commit and PR status) and the persisted verify-report (PASS verdict with all scenarios compliant).

## Key Learnings

1. `await connection()` must sit outside existing try/catch to prevent the handler from swallowing Next.js' internal `DynamicServerError` on the legacy prerender path.
2. Build exit code is 0 for both static and dynamic routes; verification must read the printed route table legend prefix (`ƒ` vs `○`) to distinguish them.
3. Request-time freshness guarantees belong in the data layer (action), not the page layer, so all callers inherit the guarantee automatically without remembering page directives.
4. A single-file, ~3-line diff exercises none of the review budget complexity, enabling straightforward single-PR delivery with no need for chaining or stacking.
5. Silent error-catch patterns (`catch { return [] }`) in data-layer actions can hide production bugs at static-build time; this change identifies the pattern as a follow-up housekeeping target.
