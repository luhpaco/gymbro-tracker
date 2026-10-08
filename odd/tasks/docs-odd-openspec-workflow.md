# Document the ODD + OpenSpec Workflow

## Objective

Align the project workflow documentation with the user-confirmed ODD + OpenSpec process, without starting F0.3 or changing application behavior.

## Problem and rationale

The project documentation still describes the legacy SDD command loop and places the detailed task checklist under each OpenSpec change. ODD is now the execution workflow and requires one detailed, versioned feature task document plus an Engram mirror. Keeping both task lists would create competing checklists.

## Scope and constraints

- Update only `CLAUDE.md`, `design/README.md`, and `openspec/config.yaml` to clarify the agreed workflow.
- Keep `odd/tasks/docs-odd-openspec-workflow.md` as the sole detailed checklist; keep the OpenSpec `tasks.md` as a pointer/index.
- Do not modify application code, start F0.3, change Notion, or create custom SDD skills.
- Preserve current project conventions except where they conflict with the confirmed workflow.

## Checklist

- [x] **WF-1** — Reconcile project workflow guidance with ODD execution and OpenSpec change/archive responsibilities; make the OpenSpec task file a pointer to the ODD checklist.

## Acceptance criteria

- Project instructions clearly state that ODD owns execution, task progress, work-unit commits, and the single detailed checklist.
- OpenSpec retains concise change intent, behavior deltas, conditional design, and dated archive; its task file does not duplicate checkboxes.
- Archive guidance includes syncing behavior deltas to canonical specs and updating the Notion status/reference.
- No application behavior or F0.3 scope is changed.

## Checks

- Structural readback of every changed document and search for contradictory legacy instructions.
- This operational documentation change has no meaningful RED/GREEN test; document the exception and perform proportional structural verification.

## Route and estimate

- Route: delegated direct.
- Trigger: three non-trivial workflow documents require coordinated edits; reading to prepare the edits belongs to the writer.
- Forecast: approximately 120 authored changed lines; delivery strategy: ask-on-risk (default), with no chain currently forecast.

## Progress and verification evidence

- Worktree was clean on `master`; created branch `docs/odd-openspec-workflow` before writing.
- Task document created before editing project workflow documentation; Engram mirror saved as #3786.
- WF-1 edited `CLAUDE.md`, `design/README.md`, and `openspec/config.yaml`; no competing checklist now remains in any of them.
- `git diff --check` passed (exit 0); `openspec/config.yaml` re-parsed as valid YAML after edits.
- Parent spot-check: `git diff --check` passed and YAML parse returned `YAML OK` after preserving the phase/task-ID/work-unit-size guidance.
- Structural readback confirmed no legacy `/sdd-*` references remain in the three target docs. Residual legacy references remain in `.claude/rules/testing.md` and `.claude/rules/worktrees.md`, which are outside the authorized edit surfaces; recorded as a follow-up risk, not edited here.
- `design/README.md` is ignored by `.gitignore` and will remain a local-only change; the tracked workflow guidance is in `CLAUDE.md` and `openspec/config.yaml`.
- Native risk assessment: medium (`executable_change` in `CLAUDE.md`); RDD is off. Structural verification is recorded instead of a code test.
- Work-unit commit pending (orchestrator-owned).

## Next step

Create the work-unit commit, then record its identity here and in the Engram mirror.
