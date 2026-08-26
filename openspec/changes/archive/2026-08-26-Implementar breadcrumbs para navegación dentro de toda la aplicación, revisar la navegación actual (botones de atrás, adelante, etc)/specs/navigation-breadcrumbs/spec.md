# Navigation Breadcrumbs Specification

## Purpose

Trail for `/(routes)` with static Spanish labels + async dynamic labels (`[id]`→exercise, `[slug]`→workout), deterministic back nav, fixed auth redirects, a11y + responsive overflow. Excluded from auth/maintenance. No Prisma in components.

## Requirements

### Requirement: Visibility Boundary

System MUST render `Breadcrumbs` in `(routes)/layout.tsx` below `Header` for all `/(routes)` routes; MUST NOT render in `auth/layout.tsx` or `/maintenance`.

#### Scenario: Visible in authenticated shell
- GIVEN auth user at `/(routes)` page
- WHEN layout renders
- THEN trail MUST appear below Header

#### Scenario: Hidden on auth/maintenance
- GIVEN user at `/auth/login`, `/auth/register`, or `/maintenance`
- WHEN page renders
- THEN trail SHALL NOT appear

### Requirement: Hierarchy Map and Group Stripping

System MUST derive crumbs from static map keyed by canonical path without `(routes)`. Parents MUST have `{label, href}`; leaf MAY omit `href`. Labels MUST be Spanish.

#### Scenario: Static hierarchy
- GIVEN path `/workouts/create`
- WHEN resolved
- THEN MUST be `Dashboard → Mis entrenamientos → Crear entrenamiento`

#### Scenario: Group stripped
- GIVEN path contains `(routes)`
- WHEN mapping
- THEN `(routes)` MUST NOT appear

### Requirement: Dynamic Segment Resolution

System MUST resolve `[id]` via `getExerciseById(id, userId)` and `[slug]` via `getWorkoutBySlug(decodedSlug, userId)` through `lib`/`data` (MUST NOT use Prisma in components). On `null`/error/missing userId MUST fallback to decoded slug/id (hyphens→spaces), never throw.

#### Scenario: Exercise resolves
- GIVEN `getExerciseById` returns `Press banca` for `/exercises/update/abc-123`
- WHEN crumbs render
- THEN leaf MUST be `Press banca`

#### Scenario: Workout null fallback
- GIVEN `getWorkoutBySlug` returns `null` for `dia-de-pierna`
- WHEN crumbs render
- THEN leaf MUST be `dia de pierna`

#### Scenario: Encoded slug decoded
- GIVEN slug `d%C3%ADa%20de%20pierna`
- WHEN resolving
- THEN MUST decode to `día de pierna` before query/fallback

### Requirement: Return Navigation Determinism

`ReturnButton` MUST require `fallbackHref: string`. MUST go back only if same-origin history exists; otherwise MUST go to `fallbackHref`. Bare `router.back()` MUST fail acceptance.

#### Scenario: History exists
- GIVEN nav Dashboard → Mis ejercicios → Editar
- WHEN ReturnButton `fallbackHref="/exercises"` pressed
- THEN SHOULD go back one entry

#### Scenario: Direct deep-link fallback
- GIVEN direct open of `/exercises/update/[id]` (empty/cross-origin history)
- WHEN ReturnButton pressed
- THEN MUST go to `fallbackHref`, MUST NOT exit app

#### Scenario: Missing fallback rejected
- GIVEN `fallbackHref` omitted
- WHEN type-checked
- THEN MUST fail

### Requirement: Auth Redirect and Guard Correction

System MUST fix `workouts/[slug]` redirect `/login`→`/auth/login`, add guard to `exercises/page.tsx`, extend `protectedRoutes` to `/exercises/update/*` and `/workouts/*`, and make `LoginForm` honor `?origin`.

#### Scenario: Unauthenticated detail
- GIVEN unauth `GET /workouts/any-slug`
- WHEN guard runs
- THEN MUST redirect to `/auth/login?origin=/workouts/any-slug`

#### Scenario: Login honors origin
- GIVEN `?origin=/exercises`
- WHEN login succeeds
- THEN MUST go to `/exercises` not `/dashboard`

#### Scenario: Sidebar hierarchical active
- GIVEN at `/workouts/dia-de-pierna`
- WHEN Sidebar renders
- THEN `Mis entrenamientos` MUST be active via `startsWith`

### Requirement: Accessible Markup

Container MUST be `nav aria-label="Breadcrumb"` with `ol>li` + separators. Current crumb MUST have `aria-current="page"` without link. Links MUST be keyboard-focusable with visible ring.

#### Scenario: Screen reader
- GIVEN trail `Dashboard → Mis ejercicios → Press banca`
- WHEN inspected
- THEN nav MUST have `aria-label`, list `ol>li`, leaf `aria-current="page"`

#### Scenario: Keyboard
- GIVEN keyboard user tabs crumbs
- WHEN focus moves
- THEN each link MUST show ring and activate on Enter

### Requirement: Responsive Overflow

Crumbs MUST `truncate`+`ellipsis`, collapse middle to `…` when overflowing, use `overflow-x-auto` at 360px without page break. Separators MUST NOT wrap.

#### Scenario: Long label 360px
- GIVEN leaf `Entrenamiento de hipertrofia de pierna muy largo`
- WHEN 360px
- THEN MUST truncate with ellipsis, container scrolls, no page overflow

#### Scenario: Collapse middle
- GIVEN 4+ segments narrow viewport
- WHEN rendered
- THEN middle MUST collapse to `…`, first/last visible

#### Scenario: No page reflow
- GIVEN any trail 360–1440px
- WHEN rendered
- THEN page MUST NOT scroll horizontally beyond container
