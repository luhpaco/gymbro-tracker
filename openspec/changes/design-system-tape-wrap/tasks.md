# Tasks: Athletic Tape & Wrap Design System

> **Reconstruction note**: this file was recreated in the `pr-3-workouts` worktree
> because the original `openspec/changes/design-system-tape-wrap/tasks.md` was
> untracked in the base branch and therefore absent from the worktree. Content is
> reproduced faithfully from Engram observations `#17` (tasks forecast), `#16`
> (design), and `#19` (PR1 apply-progress), plus the PR3 task specs. Tasks 1.1–1.7
> and 2.7–2.12 are verbatim; the remaining work units (PR2, PR4–PR7, Phase 4) are
> listed at work-unit granularity from the authoritative forecast rather than
> reconstructed sub-task wording.

## Review Workload Forecast

Session cached budget is 800 lines (review_budget_lines=800), wider than the skill's generic 400-line default. The 400-line guard line is still emitted literally for downstream automation; the actual go/no-go decision uses 800.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Estimated total changed lines (all slices): ~1,400-1,900 across 9 work units. Individual work units mostly Low-Medium against the 800 cap; PR 1 (foundation, ~450-600 lines) is the largest.

## Work units / PR chain

1. PR1 Foundation (~450-600 lines): globals.css @layer components (torn-strip polygons a/b/c/edge-bottom, reserved-region contain, heading font-bold→font-display fix), TornStrip primitive, Stat primitive, EditableStat primitive, ResumeCard adapter (zero consumer churn).
2. PR2 Exercises routes consolidation (~120-180 lines): page.tsx, ExerciseSection.tsx, FilterExercises.tsx, CreateExerciseForm.tsx, UpdateExerciseForm.tsx.
3. PR3 Workouts creation flow (~280-380 lines): WorkoutsSection.tsx, workouts/create/page.tsx, AddExerciseForm.tsx (export setSchema), workout-store.ts updateSet reducer, SummaryWorkout.tsx reserved-slot region + EditableStat wiring.
4. PR4 Dashboard (~30-60 lines).
5. PR5 Workout detail view - the ONE acknowledged logic exception: src/actions/workout/update-set.ts (Zod-validated server action + revalidatePath), WorkoutDetailSets.tsx (new client component), workouts/[slug]/page.tsx (table → TornStrip).
6. PR6 Auth full-strength (~120-170 lines): auth/layout.tsx, login/register pages + LoginForm/RegisterForm.
7. PR7 Header/Sidebar dead-dark: cleanup + ResumeCard.tsx deletion (~140-200 lines), last since it touches every screen.
Phase 4: final boundary check (git diff --stat against src/data, prisma, middleware.ts, route handlers must be empty; only new src/actions file is update-set.ts).

Ordering follows the user's explicit slice decision: shared primitives first (Phase 1), then per-route consolidation in order exercises → workouts (list/create/detail, updateSet exception lands here) → dashboard → auth (full strength) (Phase 2), then Header/Sidebar cleanup last (Phase 3).

Design's Open Questions #2 (Anton uppercase wrapping at 360px on long Spanish labels) and #3 (Sidebar active-route indicator via usePathname, optional/non-blocking) are folded into tasks 2.6/2.9 and 3.2 respectively as in-task verification/decision points, not separate blocking gates. Open Question #1 (detail-view persistence) was already resolved by the proposal's Acknowledged Exception (option A: add update-set.ts) before this tasks phase ran.

Real file paths verified via Glob/Grep against the actual repo before writing tasks.md (not just trusted from design doc): src/app/(routes)/exercises/{page.tsx,components/ExerciseSection.tsx,components/FilterExercises.tsx,create/page.tsx,update/[id]/page.tsx}, src/app/(routes)/workouts/{page.tsx,components/WorkoutsSection.tsx,create/page.tsx,[slug]/page.tsx}, src/components/{Header,Sidebar,ResumeCard}.tsx, src/components/exercise/{CreateExerciseForm,UpdateExerciseForm}.tsx, src/components/workout/{AddExerciseForm,SummaryWorkout}.tsx, src/app/auth/{layout.tsx,login/page.tsx,login/ui/LoginForm.tsx,register/page.tsx,register/ui/RegisterForm.tsx}, src/actions/workout/{create-workout,get-workout-by-slug,get-workouts}.ts (update-set.ts does not exist yet - confirmed via Glob, matches design's premise).

## Task Checklist

### Phase 1: Foundation Primitives (PR 1/7)

- [x] 1.1 globals.css `@layer components`: `.torn-strip` base (`--tear:6px`, mixed %/px polygon, `filter:drop-shadow`), `--b`/`--c`, `--edge-bottom`, `.reserved-region{contain:layout paint}`, `.torn-strip--ghost`, `.torn-strip-root`.
- [x] 1.2 heading base rule `font-bold` → `font-display uppercase tracking-wide`.
- [x] 1.3 `src/components/ui/torn-strip.tsx`: TornStrip + Header/Body/Link/Tag, CVA tone/flat, deterministic djb2 seed→variant/rot, two-layer paint/content split.
- [x] 1.4 `src/components/ui/stat.tsx`: Stat marker-face numeral in `w-[n]ch text-center tabular-nums` box.
- [x] 1.5 `src/components/ui/editable-stat.tsx`: button↔input same-box swap, blur/Enter commit, Escape cancel, injected validate, aria-invalid + red underline.
- [x] 1.6 `src/components/ResumeCard.tsx`: adapter over TornStrip, API unchanged (zero consumer churn).
- [x] 1.7 Verify: tsc 0 / lint 0 / build 0 (pre-existing env errors only). Manual screenshot DEFERRED (no browser in runtime).

### Phase 2: Route Consolidation

#### Exercises (PR 2/7, tasks 2.1–2.6)

- [ ] 2.1–2.6 Exercises routes consolidation: `exercises/page.tsx`, `ExerciseSection.tsx`, `FilterExercises.tsx`, `CreateExerciseForm.tsx`, `UpdateExerciseForm.tsx`, plus OQ#2 typography verification (Anton uppercase wrapping at 360px). *(work-unit granularity; exact sub-task wording not recoverable in this worktree)*

#### Workouts creation flow (PR 3/7, tasks 2.7–2.12)

- [x] 2.7 `src/app/(routes)/workouts/page.tsx` + `src/app/(routes)/workouts/components/WorkoutsSection.tsx`: replace `<ResumeCard>` with `<TornStrip seed={workout.id}>`; replace `text-gray-400` with `text-muted-foreground`.
- [x] 2.8 `src/app/(routes)/workouts/create/page.tsx`: replace the inline card div with `<TornStrip>`.
- [x] 2.9 `src/components/workout/AddExerciseForm.tsx`: replace the set-counter span with `Stat`; render each set block as `TornStrip` with corner tag `SERIE n`; export `setSchema` for `EditableStat.validate` without duplicating validation logic.
- [x] 2.10 `src/store/workout/workout-store.ts`: add ONLY the pure reducer `updateSet(exerciseValue, setIndex, patch)` that mutates weight/reps of an existing set in place (no append, no reorder, no `addExercise`).
- [x] 2.11 `src/components/workout/SummaryWorkout.tsx`: rebuild as a `TornStrip` shell around an `<ol>` reserved-slot region — `rowsReserved = max(3, sets.length)`, fixed `h-14` rows (`TornStrip flat`), dotted ghost strips with `pending` tag and `.torn-strip--ghost`, `.reserved-region` on container, no height transitions, weight/reps rows use `EditableStat` → `workoutStore.updateSet`, delete button `bg-red-500` → `text-destructive`.
- [x] 2.12 Verify: `tsc --noEmit` / `next lint` / `prisma generate && next build` pass (documented pre-existing warnings only) + manual checks (no browser available in runtime).

#### Dashboard (PR 4/7)

- [x] `dashboard/page.tsx`: `ResumeCard` ×2 → `TornStrip` ×2. *(work-unit granularity)*

#### Workout detail view (PR 5/7 — the acknowledged logic exception)

- [ ] `src/actions/workout/update-set.ts` (Zod-validated + revalidatePath), `WorkoutDetailSets.tsx` (new client component), `workouts/[slug]/page.tsx` (Table → TornStrip). *(work-unit granularity)*

#### Auth full-strength (PR 6/7)

- [ ] `auth/layout.tsx`, `login/page.tsx`, `register/page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`. *(work-unit granularity)*

### Phase 3: Header/Sidebar Cleanup (PR 7/7)

- [ ] Header/Sidebar dead `dark:` removal, token surfaces, `edge-bottom`, merge duplicate overlay divs, Sidebar active-route indicator (usePathname, OQ#3), `ResumeCard.tsx` deletion. *(work-unit granularity)*

### Phase 4: Final Boundary Check

- [ ] `git diff --stat` against `src/data`, `prisma`, `middleware.ts`, route handlers must be empty; only new `src/actions` file is `update-set.ts`.
