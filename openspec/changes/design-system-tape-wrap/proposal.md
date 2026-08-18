# Proposal: Athletic Tape & Wrap Design System

## Intent

Gymbro Tracker ships on the unmodified shadcn default theme — no visual identity, and no legibility tuning for its real use case (one-handed, low-attention logging mid-set in a gym). The **Athletic Tape & Wrap** direction is locked and its contract is committed in `src/app/layout.tsx`. Tokens and fonts already landed, but the token swap did not propagate: every "card" is hand-rolled markup with hardcoded `gray/white/black`, so most screens still look like default shadcn. This change applies the identity across the whole app.

## Scope

### In Scope
- Shared torn-strip surface primitive (`clip-path` polygons, near-zero radius) replacing 6+ duplicated hand-rolled card divs: `ResumeCard`, `SummaryWorkout`, `AddExerciseForm`, `workouts/create`, `exercises/create`, `exercises/update`.
- Re-skin of all routes: dashboard, exercises (list/filter/create/update), workouts (list/create/detail), auth (login/register).
- Navigation: `Header.tsx`, `Sidebar.tsx` — token-driven surfaces, removal of dead `dark:` variants and `bg-white` light fallbacks (no theme toggle exists; app is dark-only).
- Typography application: Anton for display/labels, Permanent Marker for numerals only (weight/reps/set), Inter for body.
- Build requirements from the risk register: inline edit wherever a logged set is shown/edited; fixed-region layout in active-workout contexts.

### Out of Scope
- **Rest timer / live "Serie en curso" set capture** — no data model, action, or component backs it today. Deferred to a separate SDD change.
- Any route, Prisma, or Zod logic change.
- Radix/shadcn component structure changes (`src/components/ui/*` primitives already inherit tokens).
- Logo/wordmark and icon system (follow-up).
- Adding a test runner or visual-regression tooling.

### Acknowledged Exception

`sdd-design` found that inline-edit-in-the-saved-workout-detail (an in-scope requirement, user-confirmed) has nothing to persist to: `workout-store.ts` has no `updateSet` reducer (only `addExercise`/`removeExercise`/`resetExercises`), and `src/actions/workout/` has no update action (only `create-workout`, `get-workout-by-slug`, `get-workouts`). The user explicitly accepted adding the minimal logic needed — a `updateSet` reducer and a new `src/actions/workout/update-set.ts` server action (Zod-validated, per this project's conventions) — as a narrow, named exception to the "presentation-only" boundary above. No other logic, route, or data-model change is authorized under this exception.

## Capabilities

### New Capabilities
- `visual-design-system`: the Tape & Wrap presentation contract — palette/radius tokens, typographic roles, torn-strip surface behavior, and legibility rules for numerals.

### Modified Capabilities
- None.

## Approach

1. **Foundation (done)** — tokens in `globals.css`, fonts in `layout.tsx`, `tailwind.config.ts` families.
2. **Primitive** — build the torn-strip surface as a real CSS `clip-path` component; no texture PNGs, no faked handwriting.
3. **Consolidate** — replace duplicated card markup with the primitive, feature by feature.
4. **Routes** — apply per route group, verifying legibility at each step.
5. **Navigation cleanup** — Header/Sidebar dead `dark:` removal last, since it touches every screen.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ui/` | New | Torn-strip surface primitive |
| `src/components/{Header,Sidebar,ResumeCard}.tsx` | Modified | Token surfaces, dead `dark:` removal |
| `src/components/{workout,exercise}/` | Modified | Card markup → primitive |
| `src/app/(routes)/**` | Modified | Re-skin dashboard/exercises/workouts |
| `src/app/auth/**` | Modified | Re-skin login/register |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Torn/handwritten motifs read as gimmick | Med | Real `clip-path` + embedded faces only; marker face restricted to numerals |
| Texture buries mid-set legibility | Med | High-contrast numerals; manual gym-light check before ship |
| Visual work leaks into logic/structure | Med | Presentation-layer diffs only; reject any action/route/query edit in review |
| Raises silently dropped | Med | Inline edit + fixed-region are spec requirements, verified at ship |
| Exceeds 800-line review budget | High | Chained/stacked PRs by work unit (accepted by user) |
| No visual regression safety net | High | `pnpm build` + `pnpm lint` + `tsc --noEmit` + manual/screenshot review |

## Rollback Plan

Presentation-only, so revert is safe: `git revert` the slice PRs in reverse order. Foundation commits (tokens/fonts) are independent and can stay or be reverted separately. No migrations, no data, no API surface to unwind.

## Dependencies

- Fonts already wired via `next/font/google` (Anton, Permanent Marker) — no new packages expected.

## Success Criteria

- [ ] Every in-scope route renders the Tape & Wrap identity; no hardcoded `gray/white/black` or dead `dark:` variants remain in in-scope files.
- [ ] One shared torn-strip primitive; zero duplicated hand-rolled card divs in in-scope files.
- [ ] Torn edges are `clip-path`; numerals use the embedded Permanent Marker face — no images, no faked italics.
- [ ] Inline edit and fixed-region layout hold wherever a logged set is displayed.
- [ ] `git diff` shows no changes under `src/data/`, `prisma/`, `middleware.ts`, or route handlers, and no changes under `src/actions/` other than the one acknowledged `src/actions/workout/update-set.ts` addition.
- [ ] `pnpm build`, `pnpm lint`, `pnpm exec tsc --noEmit` pass clean.
