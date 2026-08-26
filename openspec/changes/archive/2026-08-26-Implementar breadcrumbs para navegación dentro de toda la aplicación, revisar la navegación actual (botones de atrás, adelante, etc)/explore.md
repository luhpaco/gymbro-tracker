## Exploration: Breadcrumbs for application-wide navigation and current navigation review (back/forward buttons, etc.)

### Current State
App Router (Next.js 15.5 RSC, React 19, pnpm 11) with two layout shells:

- `src/app/layout.tsx` — root: fonts (Inter/Anton/Permanent_Marker), `AuthProvider`, `Toaster`, maintenance gate. `lang='en'` despite Spanish copy.
- `src/app/(routes)/layout.tsx` — authenticated shell: renders `<Header />` + `<main class="w-full h-full p-6">`. No breadcrumb slot. No bottom-dock clearance.
- `src/app/auth/layout.tsx` — centered auth shell (icon + title); must NOT show breadcrumbs.
- `src/app/page.tsx` — `Home` placeholder never hit; `next.config.mjs` redirects `/` → `/dashboard` (permanent).
- `src/middleware.ts` delegates to `authConfig.authorized` with matcher `/((?!api|_next/static|_next/image|.*\.png$).*)`.

Route tree (all under `(routes)` = protected, except auth):

```
/                     → redirect /dashboard
/auth/login           (public, but redirects to /dashboard if logged)
/auth/register        (same)
 /dashboard            RSC, auth guard → redirect /auth/login
 /exercises            RSC, currently NO auth guard (anomaly vs other routes)
 /exercises/create     RSC
 /exercises/update/[id] RSC, fetch by id + userId
 /workouts             RSC, auth guard
 /workouts/create      RSC
 /workouts/[slug]      RSC, slug = workout.tag (not id), auth guard with bug: redirect("/login") instead of "/auth/login"
 /maintenance          standalone
```

Navigation primitives today:

- **Header** (`src/components/Header.tsx`, `"use client"`): `Link href='/dashboard'` (logo), hamburger `TiThMenu` toggles `useUIStore.isSidebarOpen`.
- **Sidebar** (`src/components/Sidebar.tsx`, `"use client"`): 5 static links — Dashboard (`/dashboard`), Crear nuevo ejercicio (`/exercises/create`), Mis ejercicios (`/exercises`), Crear nuevo entrenamiento (`/workouts/create`), Mis entrenamientos (`/workouts`). Active state is strict `pathname === item.link`. Lacks depth awareness (e.g. `/workouts/[slug]` not highlighted). Overlay: absolute panel + fixed `bg-black/60` backdrop. Logout via `logout()` server action.
- **ReturnButton** (`src/components/ReturnButton.tsx`, `"use client"`): `useRouter().back()` + `Undo2` icon. Used only in `workouts/[slug]` and `exercises/update/[id]`. Problematic: `router.back()` depends on history (direct deep-link, new tab, or after login-redirect has no meaningful entry; can also exit the app).
- **Imperative navigations**: `router.push("/exercises")` after create/update exercise, `router.push("/workouts")` after create workout, `window.location.replace("/dashboard")` in `LoginForm` (bypasses `origin` query param that `auth.config.ts` sets on unauthenticated redirect), `router.replace("/auth/login")` in `RegisterForm`, RSC `redirect(...)` guards, and abundant `Link` usage.
- **No breadcrumbs exist** — `grep breadcrumb` returns 0. No `src/components/ui/breadcrumb.tsx`.

Auth implications: `auth.config.ts` `protectedRoutes = ["/dashboard","/exercises","/exercises/create","/workouts","/workouts/create"]` — does NOT list `/exercises/update/[id]` nor `/workouts/[slug]` (relying on in-page `auth()` checks). `authenticatedRoutes = ["/auth/login","/auth/register"]` — logged-in users are redirected to `/dashboard`. `authorized` appends `?origin=<pathname>` on unauthenticated redirect that `LoginForm` currently ignores.

### Affected Areas
- `src/app/(routes)/layout.tsx` — primary insertion point for a breadcrumb bar (between `Header` and `main`). Must decide: render breadcrumbs here (global) vs per-page. Add bottom padding if combined with dock changes from the sibling exploration.
- `src/components/Header.tsx` / `src/components/Sidebar.tsx` — Sidebar's 5-link flat model will feel redundant once hierarchical breadcrumbs exist; active-state logic will need range-matching (`startsWith`) and consideration alongside any future dock/side-rail from the sibling exploration. Do not break the current menu yet — coordinate.
- `src/components/ReturnButton.tsx` — history-based back is semantically superseded by breadcrumbs + explicit fallback. Either replace, deprecate, or make it safe (fallback URL when history length <=1 or referrer is external).
- `src/app/(routes)/workouts/[slug]/page.tsx` — dynamic segment using `tag` slug (human-readable, derived from name). Needs breadcrumb label = `workout.name` (async fetch). Contains the `/login` redirect bug to fix.
- `src/app/(routes)/exercises/update/[id]/page.tsx` — dynamic `[id]` needing `exercise.name` lookup for last crumb. Currently calls `getExerciseById(id, session!.user.id)` without guarding `session` null.
- `src/app/(routes)/exercises/page.tsx`, `src/app/(routes)/workouts/page.tsx`, `src/app/(routes)/dashboard/page.tsx`, `src/app/(routes)/exercises/create/page.tsx`, `src/app/(routes)/workouts/create/page.tsx` — each is a breadcrumb leaf (static labels). Exercises page lacks auth guard.
- `src/components/ui/breadcrumb.tsx` — NEW: shadcn breadcrumb primitive to create (not present). Will be built on Radix `Slot`, `cva` if needed, matching `button.tsx` / `torn-strip.tsx` patterns.
- `src/app/globals.css` / `tailwind.config.ts` — breadcrumb separator, truncation, and responsive collapse styles. Athletic Tape torn-strip palette is not suitable for breadcrumbs (must stay neutral).
- `src/lib/breadcrumbs.ts` or `src/components/breadcrumbs/` — NEW: breadcrumb config/resolver (static map + label resolvers). Must NOT contain Prisma queries directly; delegate to `src/lib/` or `src/data/` (per hard rule) and tolerate RSC vs client boundaries.
- `src/middleware.ts` / `src/auth.config.ts` — consider adding missing protected paths (`/exercises/update/*`, `/workouts/*`) so breadcrumbs never render behind a half-protected route.
- `components.json` / `src/lib/utils.ts` (`cn`) — reuses existing shadcn plumbing (`rsc: true`, `tsx: true`, paths `@/components`, `@/lib/utils`).

### Approaches
1. **Static breadcrumb config with explicit fallback for `router.back()`** — Hand-authored map `path → { label, href, parent }` (e.g. `/exercises/update/[id] → [{label:"Mis ejercicios",href:"/exercises"}, {label:"Editar ejercicio"}]`). Breadcrumb component is server-rendered, dynamic labels injected via prop or small async lookup. Keep `ReturnButton` but make it safe: `router.back()` with fallback to parent href when history is empty or cross-origin.
   - Pros: Simplest, fully controllable Spanish labels, no filesystem crawling, aligns with existing feature-grouped routes, easy a11y.
   - Cons: Must be updated when routes change; dynamic labels (exercise/workout names) require per-page plumbing.
   - Effort: Low

2. **Auto-generated from route tree (filesystem introspection)** — Derive crumbs by splitting `pathname` / `usePathname()`, mapping segments to human labels via convention (`slug` → fetch name, `update` → "Editar", `create` → "Crear"). Single global component in `(routes)/layout.tsx` handles all routes.
   - Pros: Zero config after initial mapping; automatically covers new routes; DRY.
   - Cons: Next.js 15 App Router segment conventions are lossy (`[slug]` vs `slug` value, route groups `(routes)` must be stripped, `update` is not route-segment but literal); dynamic label mapping still needs DB access; ambiguous i18n (tags are slugs, not names); `usePathname` is client-only so server accessibility/SEO benefit is lost if fully client.
   - Effort: Medium

3. **Hybrid: static config + dynamic label resolvers + RSC-first breadcrumb shell** — Static map defines hierarchy and static labels; dynamic segments register async `resolveLabel(params, userId)` functions that internally call existing data-layer helpers (`getExerciseById`, `getWorkoutBySlug`) via `src/lib`/`src/data`. Breadcrumb bar is an RSC (`async` component) rendered in `(routes)/layout.tsx`, with a small client island only for truncation/collapse interactions. `ReturnButton` is deprecated in favor of breadcrumb + page-level explicit "Regresar a X" link where the hierarchy is ambiguous.
   - Pros: Best of both — declarative hierarchy, correct RSC data fetching (no Prisma in components), dynamic exercise/workout names, no `usePathname` waterfall, full control over Spanish labels and auth-visibility (`/auth/*` excluded via layout boundary). Cleanly coexists with planned dock/side-rail (shared nav model).
   - Cons: Requires a small convention for resolvers and careful handling of RSC async boundaries / error cases (exercise not found, slug decode).
   - Effort: Medium

*Cross-cutting dimension — Back/Forward review:* Replace history-dependent `router.back()` with hierarchy-based navigation. No "forward" button exists today and none is needed for this information architecture (dashboard/exercises/workouts are siblings, not linear steps). Any retained back affordance must accept an explicit `fallbackHref` prop and be keyboard/focus accessible.

### Recommendation
Adopt **Approach 3 (Hybrid RSC-first)**. Create `src/components/ui/breadcrumb.tsx` from shadcn's canonical breadcrumb (ol > li + separator + `aria-current="page"` + `nav aria-label="Breadcrumb"`), and a thin `src/lib/breadcrumbs.ts` (or `src/components/breadcrumbs/breadcrumb-config.ts`) that exports:
```ts
type Breadcrumb = { label: string; href?: string; isCurrent?: boolean };
type Resolver = (params: { id?: string; slug?: string }, userId?: string) => Promise<string | null>;
```
Mount an async `Breadcrumbs` RSC in `src/app/(routes)/layout.tsx` immediately below `Header` (auth layout excluded). Static segments are resolved synchronously; `[id]` and `[slug]` delegate to existing actions via the data layer. Fix the two ancillary bugs in scope: `workouts/[slug]` redirect to `/auth/login` (not `/login`) and add auth guard to `exercises/page.tsx` / protectedRoutes. Deprecate `ReturnButton`'s `router.back()` (keep wrapper for backward-compat but make it `fallbackHref`-based) or replace call sites with `<Link href={parent}>`.

This keeps Prisma out of components, respects `pnpm test/build/lint` CI gates (pure-logic breadcrumb label helper is unit-testable under current Vitest Stage 1), and avoids widening the current client-bundle with `usePathname`-only logic.

### Risks
- **Dynamic labels require RSC data access**: Fetching exercise/workout names for crumbs cannot call Prisma directly from a client component. Must go through `src/lib`/`src/data` helpers and handle `null` (not found → show decoded slug/tag fallback, not crash).
- **History vs hierarchy confusion**: Users arriving via direct link/deep search have empty history; `router.back()` exiting the app is the top current UX defect. Any retained back button needs a deterministic fallback.
- **Route-group and slug quirks**: `(routes)` must be stripped from breadcrumb paths; `workouts/[slug]` uses `tag` (derived `name.toLowerCase().replace(/\s+/g,"-")`), so decoding + DB lookup is the only way to show a human name; exercises use `[id]` (UUID).
- **Redundant navigation if dock lands concurrently**: The sibling exploration proposes a mobile dock + desktop side rail. Breadcrumbs must not duplicate primary nav — crumbs are for hierarchy, dock/rail for top-level destinations. Reserve layout space once (`pb-*` / `mt-`) shared by both features.
- **Overflow on mobile**: Breadcrumb trails on `Dashboard > Mis entrenamientos > Entrenamiento: Día de pierna` will overflow `p-6` on 360px. Requires `truncate` on dynamic labels + collapsed `…` affordance (`Radix Collapsible` or simple responsive hide-middle) and `overflow-x-auto` with `aria-label`.
- **i18n & a11y**: Current UI is Spanish but `lang='en'` and breadcrumbs must use Spanish labels, `nav aria-label="Breadcrumb"` (or Spanish equivalent), `aria-current="page"` on last item, focus-visible rings from `globals.css`, and proper color contrast (do not reuse `torn-strip` drop-shadow).
- **Auth boundary leakage**: Rendering breadcrumbs in the wrong layout (root vs `(routes)`) would expose them on `/auth/*` or maintenance pages. Scope strictly to `(routes)/layout.tsx`.
- **No component-test coverage today**: Vitest Stage 1 has no jsdom/DOM tests. Breadcrumb rendering must be verified via `pnpm build` + manual browser checks (keyboard nav, screen-reader announcement, mobile truncation) until Stage 2 arrives.

### Ready for Proposal
Yes — propose the hybrid RSC breadcrumb primitive, layout insertion point, static config + async resolvers, ReturnButton remediation (fallbackHref / deprecation), ancillary auth/redirect fixes, and manual a11y/responsive verification. Keep the change within the 800-line review budget (new breadcrumb UI + config + layout tweak + two bugfixes is comfortably inside). Next steps belong in `proposal.md` / `spec.md`, not here.
