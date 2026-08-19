# Tasks: Athletic Tape & Wrap Design System

## Review Workload Forecast

Session cached budget is **800 lines** (`review_budget_lines=800`), wider than the skill's generic 400-line default. The 400-line guard line below is still emitted literally for downstream automation, but the actual go/no-go decision in this project uses 800.

| Field | Value |
|-------|-------|
| Estimated total changed lines (all slices) | ~1,400–1,900 (additions+deletions), across 9 work units |
| 400-line budget risk | High (whole-change total; individual work units mostly Low–Medium against the 800 cap) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8 (see table) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — user must pick stacked-to-main vs feature-branch-chain before `sdd-apply` starts PR 1 |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

Per-unit estimates below use the 800-line cap: only PR 1 (foundation) approaches it; every other unit has headroom. `sdd-apply` MUST NOT combine units across the chain boundary even where two units would jointly fit under 800 — each unit is scoped to one reviewable concern and one rollback boundary.

### Suggested Work Units

| Unit | Goal | Likely PR | Est. lines | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation: `globals.css` layer, `TornStrip`, `Stat`, `EditableStat` primitives, `ResumeCard` adapter, heading fix | PR 1 | ~450–600 | `pnpm build && pnpm lint && pnpm exec tsc --noEmit` | Manual: load dashboard, login — confirm new torn-edge skin renders via unchanged `ResumeCard` consumers | Revert PR 1; `ResumeCard` consumers unaffected (adapter kept old API) |
| 2 | Exercises routes consolidation | PR 2 | ~120–180 | same gate | Manual: `/exercises`, `/exercises/create`, `/exercises/update/[id]` render, filter still works | Revert PR 2 only; no other route depends on these files |
| 3 | Workouts creation flow: list/create cards + reserved-slot region + `EditableStat` wiring + `workout-store.updateSet` | PR 3 | ~280–380 | same gate | Manual: `/workouts`, `/workouts/create` — add/edit/remove a set in the creation summary, verify no layout shift (DevTools Layout Shift Regions) | Revert PR 3; creation flow falls back to add/remove-only (no edit-in-place), still functional |
| 4 | Dashboard consolidation | PR 4 | ~30–60 | same gate | Manual: `/dashboard` renders both `ResumeCard`→`TornStrip` sections | Revert PR 4 in isolation |
| 5 | Workout detail view — **acknowledged logic exception**: `update-set.ts` action + `WorkoutDetailSets.tsx` + `[slug]/page.tsx` re-skin | PR 5 | ~220–320 | same gate + manual Zod-reject test (submit invalid weight/reps) | Manual: open a saved workout, edit a set inline, refresh, confirm persisted | Revert PR 5; detail view falls back to read-only table, no data loss (action only affects `Set` rows already owned by the user) |
| 6 | Auth full-strength re-skin (login/register) | PR 6 | ~120–170 | same gate | Manual: `/auth/login`, `/auth/register` visual parity check against dashboard | Revert PR 6; auth forms fall back to `ResumeCard` adapter styling |
| 7 | Header/Sidebar dead-`dark:` cleanup + `ResumeCard.tsx` deletion | PR 7 | ~140–200 | same gate | Manual: toggle mobile sidebar overlay, verify active-link state, no `dark:`/`bg-white` classes remain (`grep`) | Revert PR 7; `ResumeCard.tsx` restored, no consumer breakage since it was already dead by then |

Decision needed before apply: chain strategy (`stacked-to-main` vs `feature-branch-chain`) — ask the user before starting PR 1.

## Phase 1: Foundation Primitives (PR 1)

- [x] 1.1 `src/app/globals.css`: add `@layer components` block — `.torn-strip` base (`--tear` custom property, mixed `%`/`px` polygon, `filter: drop-shadow`), `.torn-strip--b`/`--c` (re-seeded polygons), `.torn-strip--edge-bottom` (straight top / torn bottom, for Header/Sidebar), `.reserved-region { contain: layout paint; }`, ghost/pending slot style. Satisfies: *Torn-Strip Surface Primitive* (spec).
- [x] 1.2 `src/app/globals.css`: change heading base rule from `@apply font-bold` to `@apply font-display uppercase tracking-wide` (Anton has one weight; `font-bold` was synthetic/faux-bold). Satisfies: *Full-App Token and Typography Application* (typography scenario).
- [x] 1.3 Create `src/components/ui/torn-strip.tsx`: `TornStrip` root + `.Header`/`.Body`/`.Link`/`.Tag` compound parts, CVA `tone`/`flat`/`seed` variants; deterministic seed→hash→`variant ∈ {a,b,c}` and `--strip-rot` (no `Math.random()`, avoids SSR/CSR mismatch); structure is a two-layer paint/content split (`<span aria-hidden class="torn-strip absolute inset-0 -z-10">` + unclipped content `div`) so focus rings and overhanging tags are never clipped. Satisfies: *Torn-Strip Surface Primitive* (both scenarios).
- [x] 1.4 Create `src/components/ui/stat.tsx`: `Stat` component rendering a numeral in Permanent Marker inside a reserved `w-[<n>ch] text-center tabular-nums` box (`width?: "2ch"|"3ch"|"4ch"`). Satisfies: *Full-App Token and Typography Application* (typography scenario), *Numeral Legibility Under Gym Conditions*.
- [x] 1.5 Create `src/components/ui/editable-stat.tsx`: `EditableStat` — native `<button type="button">` display mode with dashed underline → tap swaps to `<input type="number" inputMode="numeric">` in an identically sized box, autofocus + `select()`; commit on blur/Enter, cancel on Escape; `validate` prop reuses `setSchema` (do not duplicate validation logic); invalid input stays in edit mode with `aria-invalid` + red tape border, no commit. Props: `{ value, label, unit?, width?, onCommit, validate?, disabled? }`. Satisfies: *Inline Edit in Workout Creation Summary*, *Inline Edit in Workout Detail View*.
- [x] 1.6 Modify `src/components/ResumeCard.tsx`: rewrite internals to render `TornStrip` while keeping the existing `Header`/`Body`/`Link` compound API unchanged — zero-churn adapter so its 6 consumers (dashboard ×2, `ExerciseSection`, `WorkoutsSection`, `LoginForm`, `RegisterForm`) need no edits yet. Satisfies: *Route-Level Card Consolidation* (transitional step).
- [x] 1.7 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; manual screenshot check on `/dashboard` and `/auth/login` confirming torn-edge skin renders through the unchanged `ResumeCard` API, focus ring visible on a focused card, corner tag (if any) not clipped.

## Phase 2: Per-Route Consolidation

### 2A. Exercises routes (PR 2)

- [x] 2.1 `src/app/(routes)/exercises/page.tsx`: replace inline card div (`border-gray-300 shadow-md rounded-md`) with `<TornStrip>`.
- [x] 2.2 `src/app/(routes)/exercises/components/ExerciseSection.tsx`: swap `<ResumeCard>` usage for direct `<TornStrip seed={index}>`.
- [x] 2.3 `src/app/(routes)/exercises/components/FilterExercises.tsx`: replace any hardcoded gray/white surface classes with token classes (no structural change).
- [x] 2.4 `src/app/(routes)/exercises/create/page.tsx` and `src/components/exercise/CreateExerciseForm.tsx`: replace inline card div with `<TornStrip>`.
- [x] 2.5 `src/app/(routes)/exercises/update/[id]/page.tsx` and `src/components/exercise/UpdateExerciseForm.tsx`: replace inline card div with `<TornStrip>`.
- [x] 2.6 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; `git diff --stat` shows no touched files under `src/actions/`, `src/data/`, `prisma/`. Manual check: long label "Crear nuevo ejercicio" does not wrap badly at 360px under Anton uppercase (design Open Question #2) — fall back to `normal-case` on that label only if it does.

Satisfies: *Route-Level Card Consolidation*, *Full-App Token and Typography Application*.

### 2B. Workouts creation flow: list/create + reserved-region + inline edit (PR 3)

- [x] 2.7 `src/app/(routes)/workouts/page.tsx` and `src/app/(routes)/workouts/components/WorkoutsSection.tsx`: swap `<ResumeCard>` for `<TornStrip seed={workout.id}>`; replace `text-gray-400` with `text-muted-foreground`.
- [x] 2.8 `src/app/(routes)/workouts/create/page.tsx`: replace inline card div with `<TornStrip>`.
- [x] 2.9 `src/components/workout/AddExerciseForm.tsx`: set-count `span` → `Stat`; per-set block → `TornStrip` with a `SERIE n` corner tag; export `setSchema` (consumed by `EditableStat.validate` — no new validation logic). Manual check: long label "Crear nuevo entrenamiento" does not wrap badly at 360px (Open Question #2) — same `normal-case` fallback rule as 2.6.
- [x] 2.10 `src/store/workout/workout-store.ts`: add a pure reducer `updateSet(exerciseValue, setIndex, patch)` that mutates weight/reps of an existing set in place (does not append/reorder). This is the store half of the design's authorized client-state exception — no server/schema/action impact.
- [x] 2.11 `src/components/workout/SummaryWorkout.tsx`: rebuild as `TornStrip` shell wrapping an `<ol>` reserved-slot region — `rowsReserved = max(3, sets.length)`, fixed `h-14` row height per `<li>` (`TornStrip flat`), empty slots render as dashed ghost strips with a `pending` tag, region gets the `.reserved-region` (`contain: layout paint`) class from 1.1, no height transitions (opacity only); wire each set row's weight/reps through `EditableStat` calling `workoutStore.updateSet`; replace the `bg-red-500` remove button with `text-destructive`.
- [x] 2.12 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean. Manual: add a set (writes into a visible ghost slot, no reflow), edit a set's weight/reps in place (no delete+re-add, no layout shift outside the row), remove a set — confirm via DevTools Layout Shift Regions overlay that nothing outside the region moves. Screenshot legibility check on `Stat`/`EditableStat` numerals at arm's length.

Satisfies: *Route-Level Card Consolidation*, *Inline Edit in Workout Creation Summary*, *Fixed-Region Layout in Workout Creation Summary*, *Numeral Legibility Under Gym Conditions*.

### 2C. Dashboard (PR 4)

- [x] 2.13 `src/app/(routes)/dashboard/page.tsx`: swap both `<ResumeCard>` usages for `<TornStrip>`; replace `text-gray-400` with `text-muted-foreground`.
- [x] 2.14 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; manual screenshot of `/dashboard`.

Satisfies: *Route-Level Card Consolidation*, *Full-App Token and Typography Application*.

### 2D. Workout detail view — acknowledged logic exception (PR 5)

- [x] 2.15 Create `src/actions/workout/update-set.ts`: Zod-validated server action (reuse `setSchema` shape from `AddExerciseForm.tsx`) that updates one `Set` row's weight/reps for the current user's owned workout, then `revalidatePath` on the workout detail route. **This is the one authorized logic addition per the proposal's Acknowledged Exception — do not extend it to touch any other action, route, or model.**
- [x] 2.16 Create `src/components/workout/WorkoutDetailSets.tsx` (client component): renders the set list for a saved workout using `EditableStat`, `onCommit` wired to the new `update-set` action.
- [x] 2.17 `src/app/(routes)/workouts/[slug]/page.tsx`: replace the shadcn `Table` with one `TornStrip` per exercise containing `Stat`-based rows via `WorkoutDetailSets` (mobile-first — a 4-column table is unusable one-handed mid-set).
- [x] 2.18 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; manual: open a saved workout, edit a set inline, reload the page, confirm the new value persisted; submit an invalid value (e.g. negative weight) and confirm it stays in edit mode with `aria-invalid` and no server write. Confirm `git diff --stat` shows exactly `src/actions/workout/update-set.ts` as the only new file under `src/actions/` for the whole change.

Satisfies: *Inline Edit in Workout Detail View*; proposal's Acknowledged Exception; success criterion on `src/actions/` diff scope.

### 2E. Auth — full strength (PR 6)

- [x] 2.19 `src/app/auth/layout.tsx`: apply `TornStrip`/token background, no reduced treatment vs. dashboard.
- [x] 2.20 `src/app/auth/login/page.tsx` + `src/app/auth/login/ui/LoginForm.tsx`: swap `ResumeCard`/hardcoded classes for direct `TornStrip`, Anton wordmark, `text-muted-foreground`.
- [x] 2.21 `src/app/auth/register/page.tsx` + `src/app/auth/register/ui/RegisterForm.tsx`: same treatment as 2.20.
- [x] 2.22 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; manual side-by-side screenshot of `/auth/login` vs `/dashboard` confirming equal visual strength.

Satisfies: *Full-App Token and Typography Application* (auth-parity scenario).

## Phase 3: Navigation Cleanup (last) (PR 7)

- [x] 3.1 `src/components/Header.tsx`: drop `bg-white`, `border-gray-400`, `hover:bg-slate-300 hover:text-black`; apply `bg-background` + `torn-strip--edge-bottom`; wordmark gets `font-display uppercase`.
- [x] 3.2 `src/components/Sidebar.tsx`: drop `bg-white dark:bg-gray-500`, `hover:bg-gray-100 dark:hover:bg-gray-800`; apply `bg-secondary` + `torn-strip--edge-bottom`; merge the two duplicate overlay `div`s into one `bg-black/60 backdrop-blur-sm`; active link gets `border-l-2 border-primary`. Decision point (design Open Question #3, non-blocking): active-route indicator needs `usePathname` — include it in this task if trivial, otherwise defer to a follow-up and note it in the PR description.
- [x] 3.3 Confirm every `ResumeCard` consumer now imports `TornStrip` directly (Phase 2 complete), then delete `src/components/ResumeCard.tsx`.
- [x] 3.4 Repo-wide check: `grep -rn "dark:\|bg-white" src/components src/app` returns no in-scope matches.
- [x] 3.5 Verify: `pnpm build && pnpm lint && pnpm exec tsc --noEmit` clean; manual: open mobile sidebar overlay, confirm no dead-class remnants, confirm active link indicator.

Satisfies: *Navigation Token Compliance*; success criterion on zero duplicated card markup.

## Phase 4: Final Boundary Check

- [x] 4.1 `git diff --stat` against `main` (or tracker branch) shows no changes under `src/data/`, `prisma/`, `middleware.ts`, or route handlers (`route.ts`), and the only new file under `src/actions/` across the whole change is `src/actions/workout/update-set.ts`. Satisfies: *Presentation-Only Boundary*; proposal success criteria.
- [x] 4.2 Confirm no `Math.random()` was introduced for `TornStrip` seeding (SSR/CSR hydration safety) and no texture image/PNG asset was added for the torn edge.
