# Archive Report: combine-workout-forms

## Change Summary

Replaced the two disconnected forms on `/workouts/create` (a modal dialog opened once per exercise, plus a separate final name/date form with a submit-button `onClick` hack) with one unified `react-hook-form` + `useFieldArray` form, submitted once via `createWorkout`. Added `localStorage`-backed draft persistence that survives refresh/navigation and clears on successful save.

## Final State (at close)

- **Apply**: Chained PR delivery (`size:exception`, user-approved). PR #35 (schema consolidation + draft-persistence helper + signal store, 363 lines, purely additive) → tracker `feat/combine-workout-forms` → PR #37 (component rewrite, ~1200 lines, replaces `DialogAddExercise`/`AddExerciseForm`/`SummaryWorkout`/`SummaryWorkoutForm`, deletes `useWorkoutStore`/`useUIStore`) → tracker → PR #38 (tracker → `master`). All tasks.md phases complete (7/7).
- **Verify**: PASS. 6/6 requirements, 12/12 scenarios (6 automated unit tests + all 12 confirmed by user-executed manual QA). 101 tests, 0 type errors, 0 lint errors, clean format, successful build.
- **Merged**: `master` @ `b3d3155` (2026-09-15).
- **CRITICAL issues**: None.

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| exploration.md | `archive/2026-09-15-combine-workout-forms/exploration.md` | Archived |
| proposal.md | `archive/2026-09-15-combine-workout-forms/proposal.md` | Archived |
| specs/workout-creation-form/spec.md | `openspec/specs/workout-creation-form/spec.md` | Promoted (new) |
| specs/workout-draft-persistence/spec.md | `openspec/specs/workout-draft-persistence/spec.md` | Promoted (new) |
| design.md | `archive/2026-09-15-combine-workout-forms/design.md` | Archived |
| tasks.md | `archive/2026-09-15-combine-workout-forms/tasks.md` | Archived (all phases [x]) |
| verify-report.md | `archive/2026-09-15-combine-workout-forms/verify-report.md` | Archived |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| workout-creation-form | Created (promoted) | 3 requirements, 7 scenarios — new source-of-truth spec, no prior workout-creation spec existed |
| workout-draft-persistence | Created (promoted) | 3 requirements, 5 scenarios — new source-of-truth spec |

## Mechanical Copy Evidence

- **workout-creation-form promotion**: `diff` change-spec vs promoted spec — empty (no differences). PASS.
- **workout-draft-persistence promotion**: `diff` change-spec vs promoted spec — empty (no differences). PASS.

## Commits (chronological, on `master` via merge history)

| Commit | Description |
|--------|-------------|
| `1307b5b` | PR #35 — consolidated schema, draft persistence helper, signal store (additive) |
| `3ab4ad9` | PR #37 (as #36 originally) — `WorkoutCreationForm`, old components/stores removed, nav shell repointed |
| `02bfedb` | QA fix — exercise picker reactivity (`useWatch` instead of stale field-array snapshot) |
| `cdfbf8f` | QA fix — picker close-on-select, name overflow/truncate, spacing (`TornStrip` className scoping) |
| `1a1e6b7` | QA fix — Reps/Peso column order swap |
| `af38816` | Post-merge CodeRabbit fixes — server-side Zod validation on `createWorkout`, discriminated result checked before clearing draft, `localStorage` error guards in `workout-draft.ts` |
| `b3d3155` | Merge PR #38 (tracker → master) |

## Residual Risks

None blocking. The `tagWorkout` field computed client-side and passed to `createWorkout` is still ignored server-side (the action independently recomputes an equivalent tag from `nameWorkout`+`dateWorkout`) — this is pre-existing dead-parameter behavior inherited unchanged from the deleted `SummaryWorkoutForm.tsx`, not introduced by this change, and does not affect correctness (the server-computed tag is still unique and valid). Not fixed here to stay within this change's approved scope; noted for awareness only, not logged as a separate ticket since it causes no observed problem.

## Follow-ups (logged separately as their own Notion backlog items — correctly out of scope for this change)

1. `Exercise.name` is globally `@unique`, not per-user — collides across users. https://app.notion.com/p/3dcb57b76c9b817ab44bf1344a37a5b9
2. `/workouts` has no empty state or CTA when the list is empty. https://app.notion.com/p/3dcb57b76c9b81b7a0b9fa9da07fd46f
3. Breadcrumb goes stale after client-side navigation between sibling routes (architectural, `(routes)/layout.tsx`). https://app.notion.com/p/3dcb57b76c9b8195a8b7c2cbbd3b273a

## Traceability

- **Engram topic**: `sdd/combine-workout-forms/archive-report`
- **Engram project**: `gymbro-tracker`
- **Notion backlog**: page `3a5b57b7-6c9b-819b-84a2-ca323d59c257` — set to `Listo`
- **PRs**: #35, #36 (superseded), #37, #38
