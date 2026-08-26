# Design: Breadcrumbs + Navigation Review

## Technical Approach

Hybrid RSC-first (Approach 3). Static Spanish map defines hierarchy + parent hrefs; dynamic `[id]`/`[slug]` resolve via data-layer helpers. shadcn `breadcrumb.tsx` gives a11y markup (`nav`+`ol>li`+`aria-current`). Async RSC `Breadcrumbs` mounts once in `(routes)/layout.tsx` below `Header` (auth/maintenance excluded by layout boundary). Small client island only for collapse/overflow. Fixes: `ReturnButton` determinism + auth guards + `?origin`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Primitive | shadcn vs custom | shadcn: `nav aria-label`, `ol>li`, separator, ring free; custom risks a11y drift | **shadcn** `src/components/ui/breadcrumb.tsx` (Radix Slot, `cn`) |
| Shell | RSC in `(routes)/layout` vs client `usePathname` per-page | Client loses SSR/SEO, leaks `(routes)`, duplicates plumbing | **Async RSC** below `Header`; static sync + `await` resolvers; client only for collapse |
| Label source | `lib/breadcrumbs.ts` map+resolvers vs filesystem introspection | Introspection lossy (`(routes)`, `update` vs `[id]`, `tag` slug) | **`src/lib/breadcrumbs.ts`** canonical-path map; resolvers delegate to `getExerciseById`/`getWorkoutBySlug` (no Prisma in components) |
| Back nav | bare `router.back()` vs `fallbackHref` guard vs remove | Bare exits app on deep-link | **Require `fallbackHref: string`**; same-origin check → `back()` else `push(fallbackHref)` |
| Auth scope | only `/login` typo vs full guard set | Partial leaves `/exercises` unguarded, `?origin` ignored | **All four**: fix `workouts/[slug]`, guard `exercises/page.tsx`, extend `protectedRoutes`, honor `?origin` |

## Data Flow

```
Request → (routes)/layout.tsx (RSC, auth())
          ├─ Header (client)
          ├─ Breadcrumbs (async RSC) ─┬─ staticMap[canonical] → parents {label, href}
          │                           ├─ [id]  → getExerciseById(id, userId) ─┐
          │                           ├─ [slug]→ getWorkoutBySlug(decode(slug), userId) ─┤→ label
          │                           └─ null/error/no userId → decodeFallback(hyphens→spaces), never throw
          └─ main {children}
```

Canonical = pathname minus `(routes)`, no trailing slash, `decodeURIComponent` per segment. Leaf `href` optional (current page). `Breadcrumbs` resolves parents sync then `await` dynamic leaves. Fallback: `decode(raw).replace(/-/g," ").trim() || raw` in try/catch.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/breadcrumb.tsx` | Create | shadcn: `Breadcrumb` (`nav`), `BreadcrumbList` (`ol`), `BreadcrumbItem` (`li`), `BreadcrumbLink` (`next/link`+ring), `BreadcrumbPage` (`aria-current`), `BreadcrumbSeparator` (no-wrap), `BreadcrumbEllipsis` |
| `src/lib/breadcrumbs.ts` | Create | `Breadcrumb` type, `STATIC_MAP`, `getStaticTrail()`, `resolveDynamicLabel()`, `decodeFallback()`; no Prisma |
| `src/components/breadcrumbs/Breadcrumbs.tsx` | Create | Async RSC + client `BreadcrumbsCollapse` (`overflow-x-auto`, `…` middle collapse) |
| `src/app/(routes)/layout.tsx` | Modify | Insert `<Breadcrumbs />` below `Header`; `py-2 px-6` container; coordinate `pb-*` token with dock |
| `src/components/ReturnButton.tsx` | Modify | Require `fallbackHref`; same-origin history check else `router.push(fallbackHref)` |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modify | `redirect("/login")`→`"/auth/login?origin=/workouts/"+slug`; `fallbackHref="/workouts"` |
| `src/app/(routes)/exercises/update/[id]/page.tsx` | Modify | Guard `session` before `getExerciseById`; redirect with `?origin`; `fallbackHref="/exercises"` |
| `src/app/(routes)/exercises/page.tsx` | Modify | Add `auth()` guard → `/auth/login?origin=/exercises` |
| `src/auth.config.ts` | Modify | `protectedRoutes` += `/exercises/update`, `/workouts` |
| `src/components/Sidebar.tsx` | Modify | `pathname===link` → `pathname===link \|\| pathname.startsWith(link+"/")` |
| `src/app/auth/login/ui/LoginForm.tsx` | Modify | `useSearchParams` `?origin`; `window.location.replace(validatedOrigin ?? "/dashboard")` |

## Interfaces / Contracts

```ts
// src/lib/breadcrumbs.ts
export type Breadcrumb = { label: string; href?: string; isCurrent?: boolean };
export const STATIC_MAP: Record<string, Breadcrumb[]> = {
  "/dashboard": [{ label: "Dashboard", isCurrent: true }],
  "/exercises": [{ label: "Dashboard", href: "/dashboard" }, { label: "Mis ejercicios", isCurrent: true }],
  "/workouts/[slug]": [{ label: "Dashboard", href: "/dashboard" }, { label: "Mis entrenamientos", href: "/workouts" }, { label: "__dynamic__" }],
};
export function decodeFallback(raw: string): string;
export function getStaticTrail(canonical: string): Breadcrumb[] | null;
export async function resolveDynamicLabel(seg: "id"|"slug", val: string, userId?: string): Promise<string>;
type ReturnButtonProps = { children: React.ReactNode; variant?: ButtonProps["variant"]; fallbackHref: string };
```
```tsx
// primitive shape
<nav aria-label="Breadcrumb"><ol className="flex gap-1.5 overflow-x-auto"><li className="truncate max-w-[18ch]">…</li></ol></nav>
<span aria-current="page" className="truncate">Label</span>
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `decodeFallback`, `getStaticTrail`, `resolveDynamicLabel` (hyphens→spaces, decode, null/error), `STATIC_MAP` completeness | Vitest `src/lib/breadcrumbs.test.ts`, mocked data helpers, no DB |
| Build | RSC renders for `/exercises`, `/workouts/slug` | `pnpm build` (no jsdom in Stage 1) |
| Manual | a11y (`nav aria-label`, `ol>li`, `aria-current`, tab+Enter, ring), responsive 360/768/1440 (truncate, ellipsis, `overflow-x-auto`, `…` collapse, no page reflow), visibility (in `(routes)` only), deep-link back stays in app, `?origin` flow | Checklist; gates: `pnpm build && lint && tsc --noEmit && test` |

No DOM deps added (Stage 1 excludes `jsdom`).

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Next.js routing/`?origin` is app-level, not the VCS/PR surface in `references/threat-matrix.md`.

## Migration / Rollout

No migration. No flag. Rollback: remove `<Breadcrumbs />`, delete `breadcrumb.tsx`/`breadcrumbs.ts`/`Breadcrumbs.tsx`, revert `ReturnButton`/`auth.config`/`LoginForm`/`workouts/[slug]`/`exercises/page.tsx` — one commit. Coordinate `pb-*` token with dock change.

## Open Questions

- [ ] Dock `pb-*` ownership: `main` vs `Breadcrumbs` container — propose `main` owns, breadcrumbs `py-2 px-6`
- [ ] Collapse UX: 4+ segments <640px → static `…` or clickable expand?
- [ ] Truncation widths `18ch` leaf / `12ch` parents at 360px — validate with real names
