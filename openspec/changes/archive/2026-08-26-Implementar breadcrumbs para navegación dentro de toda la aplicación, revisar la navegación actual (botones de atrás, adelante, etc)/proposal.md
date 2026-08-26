# Proposal: Breadcrumbs + Navigation Review

## Intent
Add hierarchy breadcrumbs across the app and fix fragile navigation (`router.back` exits app on direct links, `redirect("/login")` bug, missing guard on `/exercises`, `LoginForm` ignoring `?origin`).

## Scope
### In Scope
- `src/components/ui/breadcrumb.tsx` from shadcn (`nav aria-label`, `ol>li`, `aria-current="page"`).
- Async RSC `Breadcrumbs` in `src/app/(routes)/layout.tsx` below `Header` (excluded from `auth/layout.tsx`, `/maintenance`).
- `src/lib/breadcrumbs.ts`: static map + `resolveLabel` for `[id]`/`[slug]` via `src/lib`/`src/data` (no Prisma in components); fallback to decoded slug.
- `ReturnButton` requires `fallbackHref`; deprecate bare `router.back()`.
- Fixes: `workouts/[slug]` → `/auth/login`, guard on `exercises/page.tsx`, extend `protectedRoutes`, `LoginForm` honors `?origin`, `Sidebar` `startsWith` active state.
- Truncation + collapsed `…` + `overflow-x-auto`; Spanish labels; focus rings.

### Out of Scope
- Dock/side-rail impl (coordinate spacing only), route renames, `tag` migration, `lang` fix, full i18n, forward button, DOM tests (Stage 1 pure-logic only).

## Capabilities
### New Capabilities
- `navigation-breadcrumbs`: trail, dynamic resolvers, RSC rendering, a11y/overflow.

### Modified Capabilities
- None (no existing spec owns breadcrumbs).

## Approach
Hybrid RSC-first (Approach 3): static hierarchy + async resolvers calling `getExerciseById`/`getWorkoutBySlug`. RSC in `(routes)/layout.tsx`; client island only for collapse. Rejected: static-only (per-page plumbing) and auto-generated (`usePathname` client-only, lossy `(routes)`/`tag`).

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `(routes)/layout.tsx` | Modified | Mount `Breadcrumbs` below `Header` |
| `components/ui/breadcrumb.tsx` | New | shadcn primitive |
| `lib/breadcrumbs.ts` | New | Map + resolvers |
| `ReturnButton.tsx` | Modified | `fallbackHref` |
| `workouts/[slug]/page.tsx` | Modified | Fix redirect, label |
| `exercises/update/[id]/page.tsx` | Modified | Resolver, guard `session` |
| `exercises/page.tsx` | Modified | Add guard |
| `auth.config.ts`/`middleware.ts` | Modified | `protectedRoutes` |
| `Header`/`Sidebar` | Modified | `startsWith` active |
| `LoginForm.tsx` | Modified | Respect `?origin` |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dynamic label not found | Med | Slug fallback, handle `null` |
| `router.back` exits app | Med | `fallbackHref` mandatory |
| 360px overflow | Med | `truncate` + collapse + scroll |
| Auth leakage | Low | Only `(routes)/layout` |
| Dock overlap | Med | Shared spacing token |
| No DOM tests | High | `pnpm build` + manual a11y/mobile |

## Rollback Plan
Remove `Breadcrumbs` from layout, delete `breadcrumb.tsx`/`breadcrumbs.ts`, revert `ReturnButton`/`auth.config`/`LoginForm`/`workouts/[slug]`. No migration. Single revert commit.

## Dependencies
- shadcn (`components.json`, `cn`) present. Overlap with dock change — sequence or share token.

## Success Criteria
- [ ] Visible on all `(routes)`, hidden on `/auth/*` + `/maintenance`
- [ ] Dynamic crumbs show names with slug fallback
- [ ] No bare `router.back()`; deep-link back stays in app
- [ ] `pnpm build && lint && tsc --noEmit && test` pass; manual a11y + 360px check
