# Tasks: Workouts Empty State & Persistent CTA

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~25 (additions only, no deletions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Implementation

- [x] 1.1 Add persistent `Crear entrenamiento` CTA button above the workout list in `src/app/(routes)/workouts/components/WorkoutsSection.tsx` — `<Button asChild><Link href="/workouts/create">Crear entrenamiento</Link></Button>` as first child of the `<section>`, before the `.map()` block.
- [x] 1.2 Wrap the existing `workoutsToDisplay.map(...)` in a ternary on `workoutsToDisplay.length > 0` inside a `<div className="flex flex-col gap-4">` container. The truthy branch keeps the existing card JSX byte-for-byte identical. The falsy branch renders: `<p>No has creado ningún entrenamiento todavía...</p>` and `<p>¡Anímate <Link href="/workouts/create" className="underline font-semibold">a crear uno!</Link></p>`.
- [x] 1.3 Verify no `"use client"` directive, no hooks, and no event handlers were introduced in `src/app/(routes)/workouts/components/WorkoutsSection.tsx` (server component boundary per spec).

## Phase 2: Verification Gates

- [x] 2.1 Run `pnpm build` — must pass without errors.
- [x] 2.2 Run `pnpm lint` — must pass without errors.
- [x] 2.3 Run `pnpm exec tsc --noEmit` — must pass without type errors.
- [x] 2.4 Run `pnpm run format:check` — must pass (formatting clean).
