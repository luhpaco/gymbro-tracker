# Delta for Visual Design System

## ADDED Requirements

### Requirement: Named Workout-Creation State Legibility

The authenticated `/workouts/create` flow MUST present the outlined `Registrar ejercicio` trigger, open calendar, selected-date value and icon, exercise-added metadata, intentional empty pending reservation, and primary `Guardar entrenamiento` action legibly on dark surfaces. The pending reservation MUST remain visibly bounded and MUST NOT imply missing workout data.

#### Scenario: Primary actions are legible
- GIVEN an authenticated user opens `/workouts/create`
- WHEN the outlined exercise trigger and primary save action are visible
- THEN both actions MUST be legible against their dark surfaces

#### Scenario: Calendar selection remains legible
- GIVEN an authenticated user opens the workout date calendar
- WHEN a date is selected
- THEN the open calendar and selected-date value and icon MUST remain legible

#### Scenario: Empty reservation remains intentional
- GIVEN an exercise has been added without a pending set
- WHEN the workout summary displays its metadata and pending reservation
- THEN the metadata, reservation boundary, and tag MUST be visually clear
- AND the reservation MUST remain empty without implying missing data

### Requirement: Bounded Authenticated Screenshot Validation

Closeout evidence MUST include authenticated mobile and desktop screenshots of the named `/workouts/create` states. Validation MUST be limited to those states and MUST NOT require an exhaustive caller inventory, all-control state inventory, or computed contrast-ratio matrix.

#### Scenario: Named states pass at both viewport classes
- GIVEN the named workout-creation states are reachable by an authenticated user
- WHEN mobile and desktop screenshots capture each named state
- THEN every named state MUST be visibly legible in both viewport classes

#### Scenario: Required screenshot evidence is incomplete
- GIVEN any named state or viewport class lacks an authenticated screenshot
- WHEN closeout evidence is reviewed
- THEN the visual validation MUST remain incomplete until that screenshot is supplied

## MODIFIED Requirements

### Requirement: Presentation-Only Boundary

The rollout MUST NOT change server actions, Prisma queries/schema, routes, middleware, Radix/shadcn component behavior, form validation, submission outcomes, event handling, or application data flow. Form-state changes MUST remain presentational and accessibility-focused.

(Previously: The boundary protected server, route, data, and Radix/shadcn behavior without explicitly covering form validation, submission, events, or data flow.)

#### Scenario: No logic diff
- GIVEN the full change is complete
- WHEN running `git diff` against `src/actions/`, `src/data/`, `prisma/`, `middleware.ts`, route handlers
- THEN the diff is empty

#### Scenario: Form behavior is preserved
- GIVEN an affected form before and after normalized styling
- WHEN the same input, validation, submission, and keyboard interactions are performed
- THEN observable behavior and resulting data MUST remain unchanged
