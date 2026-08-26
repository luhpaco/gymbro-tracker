# Tasks: Breadcrumbs + Nav Review

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–580 |
| 400-line budget risk | Medium |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Trail + nav hardening (11 files, single revert) | PR 1 | `pnpm test src/lib/breadcrumbs.test.ts` | `pnpm dev` → `/dashboard`, `/exercises`, `/workouts/[slug]` direct, login `?origin` | Revert PR 1: delete 3 new files + revert 8 modified |

## Phase 1: Foundation — Primitive + Pure Logic (TDD RED)

- [x] 1.1 Create `src/components/ui/breadcrumb.tsx` (shadcn): nav aria-label, ol, li, Link+ring, Page aria-current, Separator no-wrap, Ellipsis
- [x] 1.2 RED: `src/lib/breadcrumbs.test.ts` — fail tests for `decodeFallback` (decode/hyphens→spaces/empty), `getStaticTrail` (canonical, strip `(routes)`, Spanish), `resolveDynamicLabel` (null/error/no userId fallback, never throw)
- [x] 1.3 Create `src/lib/breadcrumbs.ts`: `Breadcrumb` type, `STATIC_MAP` (canonical keys, parents href, leaf optional href, Spanish), `decodeFallback`, `getStaticTrail`, `resolveDynamicLabel` via `getExerciseById`/`getWorkoutBySlug` (no Prisma)

## Phase 2: Core — RSC Breadcrumbs

- [x] 2.1 Create `src/components/breadcrumbs/Breadcrumbs.tsx` async RSC: canonical from headers/pathname, sync static parents, await dynamic `[id]`/`[slug]`, render via primitives (nav>ol>li, separators, aria-current leaf)
- [x] 2.2 Create `src/components/breadcrumbs/BreadcrumbsCollapse.tsx` island: `overflow-x-auto`, truncate `18ch` leaf / `12ch` parents, collapse middle to `…` at <640px/4+ segments, `shrink-0` separators
- [x] 2.3 Wire RSC to island (RSC renders list, island only for overflow/collapse)

## Phase 3: Integration — Layout, Nav, Auth

- [x] 3.1 Modify `src/app/(routes)/layout.tsx`: mount `<Breadcrumbs />` below `Header` (`py-2 px-6`); confirm excluded from `auth/layout.tsx` + `/maintenance`
- [x] 3.2 Modify `src/components/ReturnButton.tsx`: require `fallbackHref: string`, same-origin check (`history.length`+`referrer`) → `back()` else `push(fallbackHref)`; type error if omitted
- [x] 3.3 Fix `src/app/(routes)/workouts/[slug]/page.tsx`: `"/login"`→`"/auth/login?origin=/workouts/"+slug`, add `fallbackHref="/workouts"`
- [x] 3.4 Fix `src/app/(routes)/exercises/update/[id]/page.tsx`: guard `auth()` before `getExerciseById`, redirect `?origin`, add `fallbackHref="/exercises"`
- [x] 3.5 Add guard `src/app/(routes)/exercises/page.tsx`: `auth()`→`"/auth/login?origin=/exercises"`
- [x] 3.6 Modify `src/auth.config.ts`: `protectedRoutes` += `/exercises/update`, `/workouts` (prefix match)
- [x] 3.7 Modify `src/components/Sidebar.tsx`: `===`→`=== || startsWith(link+"/")` for hierarchical active
- [x] 3.8 Modify `src/app/auth/login/ui/LoginForm.tsx`: `useSearchParams` `?origin`, validate same-origin path, `location.replace(origin ?? "/dashboard")`

## Phase 4: Testing & Verification

- [x] 4.1 GREEN: make `breadcrumbs.test.ts` pass + `STATIC_MAP` completeness (all spec routes)
- [x] 4.2 Gates: `pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm build` — must pass (no jsdom)
- [x] 4.3 Manual a11y: nav aria-label, ol>li, aria-current leaf, Tab+Enter, focus ring
- [x] 4.4 Manual responsive: 360/768/1440 — truncate ellipsis, `overflow-x-auto` no page reflow, middle `…` collapse, no-wrap separators
- [x] 4.5 Manual nav: deep-link `/exercises/update/[id]` fallback, no crumbs on `/auth/*`/`/maintenance`, `?origin` round-trip

## Phase 5: Cleanup

- [x] 5.1 `pnpm run format`, ensure no Prisma in `src/components/**`, remove scaffolding
- [x] 5.2 Notes: rollback = single commit deleting 3 new files + reverting 8 modified
