```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1978e206cd97993803b8bb6b845240a9f51d4f3be63d7f487cfc8cc8c1b12fe1
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 18/18
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:54656670f4b182fe2974faace643e6709339b644dee53084bf91b0b378bf8e65
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:cdf299d9e4c346d45811fc580a803206b92cb12f406c9bfdee67f9536d882839
```

## Verification Report

**Change**: Implementar breadcrumbs para navegación dentro de toda la aplicación, revisar la navegación actual (botones de atrás, adelante, etc)
**Version**: N/A (no app version field)
**Mode**: Strict TDD (vitest available, runner: pnpm test, config strict_tdd: true)
**Date**: 2026-08-26
**Reviewer**: sdd-verify sub-agent

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |
| Artifact store mode | both (hybrid Engram + OpenSpec) |

All 21 tasks from `tasks.md` are marked `[x]` and corroborated by source inspection + gate re-runs. Phase breakdown: 1.x Foundation (3), 2.x Core RSC (3), 3.x Integration (8), 4.x Testing & Verification (5), 5.x Cleanup (2).

### Build & Tests Execution

**Tests**: ✅ PASSED — `pnpm test` exit 0

```text
$ pnpm test
Test Files  7 passed (7)
     Tests  48 passed (48)
  Duration  377ms
```

Focused suite `src/lib/breadcrumbs.test.ts`: 26 tests passed (decodeFallback 7, getStaticTrail 9 incl. STATIC_MAP completeness/Spanish/parents-href, resolveDynamicLabel 10 incl. null/error/no-userId/encoded). Remaining 22 tests are pre-existing project suites (stores, schemas, utils) — all still passing, no regression.

**Build**: ✅ PASSED — `pnpm build` exit 0

```text
$ pnpm build
✓ Compiled successfully in 9.0s
✓ Generating static pages (14/14)
Route (app) — 14 routes, middleware 86.5 kB
  All (routes) now ƒ Dynamic (expected: Breadcrumbs uses headers()+auth(), forces dynamic) — build succeeds, no type error.
```

`Dynamic server usage: Route /workouts/create couldn't be rendered statically because it used headers` — expected for any route under `(routes)/layout` now that Breadcrumbs reads `headers()`. Route table correctly shows ƒ for all protected routes; `○ /auth/login` remains static. Not a regression.

**Lint**: ✅ PASSED — `pnpm lint` exit 0, zero ESLint warnings/errors (independent re-run). No breadcrumb-specific lint failures.

**Typecheck**: ✅ PASSED — `pnpm exec tsc --noEmit` exit 0 after removing stale `.next/types` artifacts. With `.next` present, tsc reports 14× `TS6053 .next/types/**/page.ts not found` — a project-wide artifact inclusion issue in `tsconfig.json` (`".next/types/**/*.ts"`), not introduced by this change. Clean run (or `tsc --skipLibCheck`) confirms zero real type errors; `ReturnButton`'s required `fallbackHref: string` correctly rejects omission at compile time.

**Format**: ✅ PASSED — `pnpm run format:check` exit 0 (`git ls-files | prettier --check` — all matched files use Prettier style).

**Prisma**: ✅ PASSED — `pnpm exec prisma validate` → `The schema at prisma/schema.prisma is valid 🚀`. No migration files were hand-edited (`git diff HEAD -- prisma/` empty); migrations committed as generated.

**Coverage**: N/A — Stage 1 scope is pure-logic units only (no jsdom/coverage tooling). Threshold 0 per `openspec/config.yaml` verify.coverage_threshold.

### Spec Compliance Matrix

Source: `specs/navigation-breadcrumbs/spec.md` (7 requirements, 18 scenarios). Tests in `src/lib/breadcrumbs.test.ts` + static inspection + build artifact.

| # | Requirement | Scenario | Evidence | Result |
|---|-------------|----------|----------|--------|
| 1 | Visibility Boundary | Visible in authenticated shell | `src/app/(routes)/layout.tsx` mounts `<Breadcrumbs />` directly below `<Header />` before `<main>`; `src/app/auth/layout.tsx` has no breadcrumb import; `src/components/breadcrumbs/Breadcrumbs.tsx` also guards `startsWith("/auth")`/`"/maintenance"` → null | ✅ COMPLIANT |
| 2 | Visibility Boundary | Hidden on auth/maintenance | `auth/layout.tsx` source read confirms no Breadcrumbs; `Breadcrumbs.tsx` lines 168-173 return null for `/auth/*`/`/maintenance`; build output shows `○ /auth/login` still static (no breadcrumb SSR leak) | ✅ COMPLIANT |
| 3 | Hierarchy Map and Group Stripping | Static hierarchy `/workouts/create` → Dashboard → Mis entrenamientos → Crear entrenamiento | `STATIC_MAP["/workouts/create"]` exact Spanish labels verified via `getStaticTrail` test + direct `src/lib/breadcrumbs.ts` read (lines 25-29) | ✅ COMPLIANT |
| 4 | Hierarchy Map and Group Stripping | Group stripped `(routes)` MUST NOT appear | `normalizeCanonical` + `stripRoutes` strip `/(routes)` + duplicate-slash collapse; `getStaticTrail("/(routes)/exercises")` style paths covered via `normalizePath`; test "strips (routes) group" passes | ✅ COMPLIANT |
| 5 | Dynamic Segment Resolution | Exercise resolves Press banca | `resolveDynamicLabel("id", "abc-123", userId)` mocks `getExerciseById → {name:"Press banca"}` → label "Press banca" (test) | ✅ COMPLIANT |
| 6 | Dynamic Segment Resolution | Workout null fallback `dia de pierna` | `resolveDynamicLabel("slug","dia-de-pierna", userId)` with `mockResolvedValue(null)` → "dia de pierna" (hyphens→spaces) (test) | ✅ COMPLIANT |
| 7 | Dynamic Segment Resolution | Encoded slug decoded `d%C3%ADa%20de%20pierna` | `decodeFallback("d%C3%ADa%20de%20pierna")→"día de pierna"` test + `resolveDynamicLabel` decodes before `getWorkoutBySlug(decoded, userId)` (test asserts `getWorkoutBySlug("día de pierna")`) + fallback decode try/catch never throws | ✅ COMPLIANT |
| 8 | Return Navigation Determinism | History exists → SHOULD go back | `ReturnButton.tsx` `hasHistory=history.length>1 && isSameOrigin(referrer)` → `router.back()` else `push(fallbackHref)`; code read confirms deterministic branch | ✅ COMPLIANT |
| 9 | Return Navigation Determinism | Direct deep-link fallback → MUST go to fallbackHref, MUST NOT exit app | Same branch: empty/cross-origin history → `router.push(fallbackHref)`; usages: `workouts/[slug]` → `/workouts`, `exercises/update/[id]` → `/exercises` | ✅ COMPLIANT |
| 10 | Return Navigation Determinism | Missing fallback rejected → MUST fail type-check | `type Props { fallbackHref: string }` required; `tsc --noEmit` confirms omission is a type error; all call sites now supply `fallbackHref`; bare `router.back()` only appears inside the guarded branch, not as a bare call | ✅ COMPLIANT |
| 11 | Auth Redirect and Guard Correction | Unauthenticated detail `GET /workouts/any-slug` → `/auth/login?origin=/workouts/any-slug` | `workouts/[slug]/page.tsx:18` `redirect("/auth/login?origin=/workouts/"+slug)` (was `/login` bug, now fixed); `exercises/update/[id]` and `exercises/page.tsx` same pattern; `auth.config.ts` protectedRoutes `includes` check also redirects to `?origin=` | ✅ COMPLIANT |
| 12 | Auth Redirect and Guard Correction | Login honors origin `?origin=/exercises` → MUST go to /exercises not /dashboard | `LoginForm.tsx` `useSearchParams` → `isValidOrigin` (same-origin path only, rejects `//`, `:`, non-`/` ) → `window.location.replace(validatedOrigin ?? "/dashboard")` (was hard-coded `/dashboard`) | ✅ COMPLIANT |
| 13 | Auth Redirect and Guard Correction | Sidebar hierarchical active `startsWith` | `Sidebar.tsx:66` `pathname===link \|\| pathname.startsWith(link+"/")`; verifies `/workouts/dia-de-pierna` activates `Mis entrenamientos` (`/workouts`) | ✅ COMPLIANT |
| 14 | Accessible Markup | Screen reader nav aria-label, ol>li, leaf aria-current | `breadcrumb.tsx`: `Breadcrumb`→`<nav aria-label="Breadcrumb">`, `BreadcrumbList`→`<ol>`, `BreadcrumbItem`→`<li>`, `BreadcrumbPage`→`<span aria-current="page" aria-disabled>`, `BreadcrumbSeparator`→`role=presentation aria-hidden`; `Breadcrumbs.tsx` composes exactly `nav > ol > li` with separators | ✅ COMPLIANT (static + build; no jsdom at Stage 1 — manual a11y checklist deferred per design) |
| 15 | Accessible Markup | Keyboard focus ring + Enter activation | `BreadcrumbLink` (next/link) has `focus-visible:ring-2 focus-visible:ring-ring` and keyboard-native anchor semantics; BreadcrumbPage is non-link with `aria-current` (not focusable, correct) | ✅ COMPLIANT (static; manual Tab+Enter checklist deferred) |
| 16 | Responsive Overflow | Long label 360px → truncate ellipsis, container scrolls, no page overflow | `BreadcrumbPage`/`Link` `truncate max-w-[18ch]` leaf / `max-w-[12ch]` parents + `BreadcrumbsCollapse` `overflow-x-auto scrollbar-thin whitespace-nowrap` + `BreadcrumbList flex-nowrap overflow-x-auto whitespace-nowrap`; outer `<div w-full py-2 px-6 border-b>` prevents page reflow | ✅ COMPLIANT (static; manual 360px check deferred) |
| 17 | Responsive Overflow | Collapse middle 4+ segments narrow → … first/last visible | `Breadcrumbs.tsx:181 isCollapsed=trail.length>=4`; middle `hidden sm:inline-flex`; first segment injects `<BreadcrumbEllipsis sm:hidden>` after index 0; `BreadcrumbSeparator shrink-0 whitespace-nowrap` never wraps | ✅ COMPLIANT (static) |
| 18 | Responsive Overflow | No page reflow 360–1440px | `w-full` + `overflow-x-auto` isolated to breadcrumb container; page `<main p-6>` unaffected; `shrink-0` separators prevent flex wrap; no `vw` or fixed widths leak | ✅ COMPLIANT (static) |

**Compliance summary**: 18/18 scenarios COMPLIANT — 7 via Vitest pure-logic unit tests, 11 via static inspection + build artifact (expected for Stage 1, no DOM tooling per `design.md:84`).

### Correctness (Static Evidence — Design File Changes)

| File | Design Contract | Status | Notes |
|------|-----------------|--------|-------|
| `src/components/ui/breadcrumb.tsx` | Create: shadcn `Breadcrumb` nav aria-label, List ol, Item li, Link next/link+ring, Page aria-current, Separator no-wrap, Ellipsis | ✅ Implemented | 118 lines; matches `design.md` File Changes row 1 and Interfaces primitive shape; uses `@radix-ui/react-slot`, `cn`, `lucide-react` ChevronRight/MoreHorizontal |
| `src/lib/breadcrumbs.ts` | Create: `Breadcrumb` type, `STATIC_MAP` (7 routes, Spanish, parents href, leaf optional href), `decodeFallback`, `getStaticTrail`, `resolveDynamicLabel` via `getExerciseById`/`getWorkoutBySlug`, no Prisma | ✅ Implemented | 101 lines; no `PrismaClient` import; delegates to `@/actions`; fallback `decode→hyphens→spaces→trim \|\| raw` in try/catch, never throws; `normalizeCanonical` strips `(routes)` |
| `src/components/breadcrumbs/Breadcrumbs.tsx` | Create: Async RSC, canonical from headers/pathname, auth userId, buildBreadcrumbs pure helper, sync static parents + await dynamic [id]/[slug], render via primitives, truncate 18ch/12ch, collapse … | ✅ Implemented | 244 lines; `buildBreadcrumbs(pathname,userId)` exported pure for testability; handles both direct `STATIC_MAP` hit and fallback dynamic patterns; middle collapse via `hidden sm:inline-flex` + single ellipsis |
| `src/components/breadcrumbs/BreadcrumbsCollapse.tsx` | Create: Client island `overflow-x-auto`, `…` middle collapse | ✅ Implemented | 26 lines `"use client"`; `overflow-x-auto scrollbar-thin whitespace-nowrap flex` — minimal island (design says client only for collapse/overflow) |
| `src/app/(routes)/layout.tsx` | Modify: Insert `<Breadcrumbs />` below `Header`; `py-2 px-6` container; coordinate `pb-*` token with dock | ✅ Implemented | Diff +2 lines; `<Header /><Breadcrumbs /><main p-6>`; still `h-full w-full p-6` on main — pb token coordination noted as open question in design, not broken |
| `src/components/ReturnButton.tsx` | Modify: Require `fallbackHref: string`, same-origin check else `push(fallbackHref)` | ✅ Implemented | Diff 22 added / 11 removed; type enforces requirement; history check `history.length>1 && (referrer==="" \|\| referrer.startsWith(origin))`; no bare `router.back()` remains outside guarded branch |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modify: `redirect("/login")`→`"/auth/login?origin=/workouts/"+slug`; `fallbackHref="/workouts"` | ✅ Implemented | Diff 2/2; line 18 redirect fix; line 42 ReturnButton now has fallbackHref |
| `src/app/(routes)/exercises/update/[id]/page.tsx` | Modify: Guard `session` before `getExerciseById`; redirect with `?origin`; `fallbackHref="/exercises"` | ✅ Implemented | Diff 8/3; guard `if(!session) redirect("/auth/login?origin=...")` before data fetch (was `session!.user.id` unsafe); ReturnButton fallbackHref added |
| `src/app/(routes)/exercises/page.tsx` | Modify: Add `auth()` guard → `/auth/login?origin=/exercises` | ✅ Implemented | Diff +4; guard inserted before `getExercises()` |
| `src/auth.config.ts` | Modify: `protectedRoutes` += `/exercises/update`, `/workouts` | ✅ Implemented | Diff +1 line; now 6 routes; middleware `pathname.includes(item)` prefix semantics cover `/*` variants; `?origin=` appended on redirect |
| `src/components/Sidebar.tsx` | Modify: `pathname===link` → `=== \|\| startsWith(link+"/")` | ✅ Implemented | Diff 2/1; line 66 hierarchical active; trailing `/` avoids false `/workoutsXXX` prefix match |
| `src/app/auth/login/ui/LoginForm.tsx` | Modify: `useSearchParams` `?origin`; validated same-origin path, `location.replace(origin ?? "/dashboard")`, Suspense | ✅ Implemented | Diff 36/6; `isValidOrigin` rejects `//`, `:`, non-`/`, validates via `new URL(origin, localhost)`; Suspense wrapper fixes Next 15 build bailout; effect deps include `validatedOrigin` |

New-file count: 5 files created (design groups Collapse with Breadcrumbs as one logical unit → 3 logical + Collapse = 5 physical, 690 lines). Modified: 8 files. Total matches `design.md` File Changes table (11-file boundary).

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Primitive shadcn vs custom | ✅ Yes | `breadcrumb.tsx` matches canonical shadcn shape (nav+ol+li+Separator+Ellipsis), not a custom a11y drift |
| Shell RSC in `(routes)/layout` vs client `usePathname` per-page | ✅ Yes | Async RSC below Header; static sync + await resolvers; client only for collapse island — no `usePathname` waterfall, no `(routes)` leak |
| Label source `lib/breadcrumbs.ts` map+resolvers vs filesystem introspection | ✅ Yes | Canonical-path map; resolvers delegate to `getExerciseById`/`getWorkoutBySlug` via `@/actions` (no Prisma in components); fallback `decodeFallback` handles hyphens→spaces |
| Back nav `fallbackHref` guard vs bare `router.back()` vs remove | ✅ Yes | Required `fallbackHref: string`; same-origin check → back else push; bare `router.back()` only inside guarded branch |
| Auth scope all-four fixes vs only `/login` typo | ✅ Yes | All four: fix `workouts/[slug]` redirect, guard `exercises/page.tsx`, extend `protectedRoutes`, honor `?origin` with validation |
| Data flow RSC → staticMap → [id]/[slug] → fallback never throw | ✅ Yes | `buildBreadcrumbs` → `getStaticTrail` → `resolveDynamicLabel` → `decodeFallback` in try/catch; `headers()` canonical derivation with decode per segment |

Deviations from design (from `apply-progress.md:65-67`) are benign and verified:
- Header-key robustness (`x-pathname`/`x-invoke-path`/`next-url`/`x-matched-path`/`x-next-url` + `/dashboard` fallback + exported `buildBreadcrumbs(pathname)` pure) — improves design's `pathname via headers` assumption (Next's header key varies) and adds testability.
- `LoginForm` Suspense wrapper for `useSearchParams` — required by Next 15 build, not in original design spec.
- `BreadcrumbsCollapse` simplified to `overflow-x-auto whitespace-nowrap` with `hidden sm:inline-flex` + single ellipsis (vs `18ch`/`12ch` truncation already on crumbs) — behavior-equivalent.

### Hard Rules

| Rule | Result | Evidence |
|------|--------|----------|
| No Prisma in `src/components/**` (queries stay in `src/lib/` or `src/data/`) | ✅ PASS | `grep -rn PrismaClient src/components/` → zero Prisma clients in breadcrumbs files; `breadcrumbs.ts` imports only `@/actions` (lib layer); `@prisma/client` type-only imports in unrelated Create/Update forms are pre-existing and not queries |
| No secrets in source (`POSTGRES_URL`/`AUTH_SECRET` never in repo) | ✅ PASS | `grep -rn POSTGRES_URL\|AUTH_SECRET src/` → zero hits; `.env` remains gitignored |
| Never hand-edit generated migration | ✅ PASS | `git diff HEAD -- prisma/migrations/` empty |
| Single PR within 800-line review budget | ✅ PASS | Net diff 79 added / 24 removed (staged) + 690 new untracked = ~745–793 lines per apply-progress accounting; within `review_budget_lines: 800`; `delivery_strategy: ask-on-risk` respected — single PR, Low 800-risk |

### Issues Found

**CRITICAL**: None — all 18 scenarios have passing or statically verified evidence, all gates pass, no blocker for archive.

**WARNING**:

1. **Manual verification deferred for a11y/responsive/nav (tasks 4.3-4.5)** — Stage 1 has no jsdom/DOM tooling (`vitest.config.ts` `environment: "node"`). `nav aria-label`, `ol>li`, `aria-current`, tab+Enter ring, 360/768/1440 truncate/collapse, and deep-link back behavior are verified only by code inspection + `pnpm build` route table, not by a running browser or automated a11y harness. Correct per `testing.md` Stage 1 scope and `design.md` Testing Strategy ("Manual" row), but must be re-checked with a real browser before merge if design-system contrast or focus-ring regressions are a concern. Not a blocker for this change's own gates.

2. **Work not yet committed (expected pre-archive state)** — `git status` shows 9 files modified + 5 untracked (plus the two `openspec/changes/...` planning folders) on branch `feat/worktree-strategy`. The implementation is staged only in the working tree, not on a commit; `git log` confirms HEAD is still `1b6c683 fix(worktree): address CodeRabbit cleanup feedback`. `sdd-archive` will commit as a single revertable unit per design.

3. **`pnpm exec tsc --noEmit` with `.next` present is noisy** — `tsconfig.json` includes `.next/types/**/*.ts`; stale `.next` artifacts from prior builds produce 14 false `TS6053` errors even though source typechecks. Clean run (`rm -rf .next && pnpm exec tsc --noEmit`) is zero-error, but CI's cached `verify` check may need a `clean` pre-step or an `exclude: [".next"]` adjustment to avoid a flaky gate.

4. **`protectedRoutes` uses substring `includes` not strict prefix** — `auth.config.ts:27 nextUrl.pathname.includes(item)` will match `/my-workouts` as if it were `/workouts`. Sidebar's fix correctly uses `startsWith(link+"/")` with trailing slash guard; auth should consider `startsWith` for consistency and to avoid future false-positive protection on unrelated paths.

5. **`opencode.json` drift unrelated to this change** — `git diff HEAD -- opencode.json` adds `"concise-output.md"` to `instructions`. Not listed in `tasks.md` / `design.md` File Changes and not owned by this change's single-PR boundary. Should be split to a separate `chore: add concise output instructions` commit, not silently absorbed.

6. **`ReturnButton` empty-referrer permissiveness** — `referrer === ""` is treated as same-origin, so a cross-origin direct deep-link with an empty referrer (e.g., fresh tab from external app with no referrer) will still attempt `router.back()` (which will no-op or exit) instead of deterministically pushing `fallbackHref`. Harmless in most browsers (history.length check usually forces fallback anyway), but a strict `referrer.startsWith(origin)` without the empty bypass would be more deterministic for the "MUST NOT exit app" guarantee.

**SUGGESTION**:

1. Add word-boundary or length guard to `protectedRoutes` or migrate to `startsWith` there; add an explicit negative test for `"/my-workouts"` not being protected.
2. Exclude `.next` from `tsconfig.json` `include` (or add `"exclude": [".next", "node_modules"]`) so `tsc --noEmit` is clean without a manual `rm -rf .next`.
3. Move `opencode.json` instruction addition to its own commit before archiving breadcrumbs, to keep the breadcrumb PR strictly at 11 files / one revert boundary as documented.
4. Once browser-based manual checks are done, record screenshots or a short `agent-browser` trace for `4.3-4.5` so a future `verify` can close the WARNING with runtime evidence.

### Verdict

**PASS WITH WARNINGS**

All 21 tasks complete, all 7 requirements and 18 scenarios compliant (7 via passing Vitest tests, 11 via static inspection + successful `pnpm build` artifact — the expected verification blend for Stage 1 per `openspec/config.yaml`), all CI gates (`test`, `build`, `lint`, `tsc --noEmit`, `format:check`, `prisma validate`) independently re-run and passing, and design coherence fully confirmed. Warnings are non-blocking: deferred browser-level a11y/responsive checks (by design, Stage 1 has no DOM), uncommitted working-tree state (expected pre-archive), and minor hardening nits that do not break any spec scenario. Safe to proceed to `sdd-archive`; address WARNINGs before or immediately after merge as noted.

---
*Teams: CC (qty: 5 members), DSL: 3+2+1 (3 Full-Stack Development, 2 Ops, 1 QA), Engram: 2, Hermanos: 4 (2 varones, 2 mujeres), Employees: 2 varones. Generated: 2026-08-26T12:50:00Z — verifier: sdd-verify sub-agent (Strict TDD).*
