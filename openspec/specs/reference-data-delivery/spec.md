# Reference Data Delivery Specification

## Purpose

Defines request-time freshness guarantees for global, non-user-scoped reference data (e.g. muscle groups) reaching render surfaces. Reference data has no `auth()` call to force dynamic rendering, so without an explicit freshness signal Next.js 15 statically prerenders the consuming route at build time and freezes whatever the reference-data fetch returned at that moment into the served HTML.

## Requirements

### Requirement: Request-Time Freshness for Global Reference Data

`getMuscleGroups()` MUST force per-request execution so its result is never baked into a static build output. The freshness guarantee MUST live in the data-layer action itself, not in the calling page, so any future caller inherits it automatically.

#### Scenario: Selector reflects live database state

- GIVEN the `MuscleGroup` table holds 14 canonical rows
- WHEN a user requests `/exercises/create`
- THEN `getMuscleGroups()` executes its Prisma query at request time
- AND the rendered muscle-group `<Select>` is populated with all 14 rows

#### Scenario: Consuming route is classified as dynamic at build time

- GIVEN `CreateExercisePage` calls `getMuscleGroups()` and uses no other dynamic API
- WHEN `pnpm build` runs
- THEN the build output lists `/exercises/create` as dynamic (`ƒ (Dynamic) server-rendered on demand`)
- AND the route is not listed as static (`○ (Static) prerendered as static content`) — `●` denotes SSG routes using `generateStaticParams`, which this route never used, and is not a possible symbol for it either way

#### Scenario: Database unreachable at request time (pre-existing, unchanged behavior)

- GIVEN `getMuscleGroups()` executes at request time per this requirement
- WHEN the database is unreachable during that request
- THEN the pre-existing silent catch returns an empty array
- AND the muscle-group `<Select>` renders empty for that single request only, self-healing on the next request once the database is reachable

## Non-Goals

- Changing the silent-catch-to-`[]` error-handling pattern (tracked separately as Housekeeping).
- Any caching strategy (`unstable_cache`, ISR, PPR).
- `getExercises()` / `getWorkouts()` — already dynamic via `auth()`, cannot exhibit the build-frozen bug this capability addresses.
