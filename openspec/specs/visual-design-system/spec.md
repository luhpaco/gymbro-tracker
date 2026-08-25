# Visual Design System Specification (Athletic Tape & Wrap)

## Purpose

Presentation contract for Gymbro Tracker's dark-only "Athletic Tape & Wrap" identity: shared torn-strip primitive, consuming routes, typography roles, and the carried-over raises (inline edit, fixed-region layout). No logic, route, data, or Radix/shadcn structural change.

## Requirements

### Requirement: Torn-Strip Surface Primitive

The system MUST provide one shared surface component implementing the torn-strip motif via CSS `clip-path` polygons and near-zero border radius, replacing all hand-rolled card divs.

#### Scenario: Primitive built before consumption
- GIVEN the design system rollout is starting
- WHEN any route or component needs a card-like surface
- THEN it MUST consume the shared primitive, not a local duplicate

#### Scenario: No texture assets
- GIVEN the primitive's torn edge
- WHEN inspecting its implementation
- THEN it MUST use `clip-path` polygons only — no texture image, no faked tear

### Requirement: Route-Level Card Consolidation

Every in-scope card usage (`ResumeCard`, `SummaryWorkout`, `AddExerciseForm`, workouts/exercises create/update) MUST consume the shared primitive; zero duplicated hand-rolled card markup MUST remain.

#### Scenario: Duplicated markup removed
- GIVEN `ResumeCard.tsx` hardcodes `border border-gray-300 shadow-md p-6 rounded-md`
- WHEN the rollout completes
- THEN it renders the shared primitive with no hardcoded gray/white/black classes

### Requirement: Full-App Token and Typography Application

Dashboard, exercises (list/filter/create/update), workouts (list/create/detail), and auth (login/register) MUST render exclusively via design tokens (palette, radius), with no hardcoded `gray/white/black` classes. Auth MUST get the same identity strength as the rest of the app, not a reduced treatment.

#### Scenario: Auth gets full treatment
- GIVEN a user opens login or register
- WHEN comparing it to the dashboard
- THEN both use the same primitive, token palette, and typography at equal strength

#### Scenario: Typography roles applied
- GIVEN any screen renders a numeral (weight/reps/set number)
- WHEN inspecting the font
- THEN the numeral uses Permanent Marker, headings/labels use Anton, body copy uses Inter

### Requirement: Navigation Token Compliance

`Header.tsx` and `Sidebar.tsx` MUST use token-driven surfaces with no dead `dark:` variants or light-mode `bg-white` fallbacks.

#### Scenario: Dead dark: variants removed
- GIVEN no theme toggle exists in the app
- WHEN inspecting `Header.tsx` and `Sidebar.tsx`
- THEN no `dark:` variant or `bg-white` fallback class remains

### Requirement: Inline Edit in Workout Creation Summary

A logged set in the in-progress workout-creation summary (`AddExerciseForm`/summary flow) MUST be editable (weight/reps) in place, without removing and re-adding it.

#### Scenario: Edit a set in place during creation
- GIVEN a user has added a set to the creation summary
- WHEN they edit that set's weight or reps
- THEN values change in place — no delete-and-re-add required

### Requirement: Inline Edit in Workout Detail View

A logged set shown in an already-saved workout's detail view MUST be editable in place, without a separate edit mode or screen.

#### Scenario: Edit a saved set from detail view
- GIVEN a user opens a saved workout's detail view
- WHEN they edit a displayed set
- THEN the value becomes editable in place within that same view

### Requirement: Fixed-Region Layout in Workout Creation Summary

The list of added sets in the workout-creation summary MUST occupy a stable layout region that does not reflow or jump as sets are added, edited, or removed.

#### Scenario: No layout shift on add
- GIVEN a user is adding sets to the creation summary
- WHEN a new set is added
- THEN surrounding elements MUST NOT shift outside the set list's own region

#### Scenario: No layout shift on edit or remove
- GIVEN the creation summary shows multiple sets
- WHEN a set is edited or removed
- THEN the layout MUST NOT reflow beyond the affected row

### Requirement: Numeral Legibility Under Gym Conditions

Numerals (weight, reps, set number) MUST read clearly at a glance under typical gym lighting on a phone screen — verified qualitatively, no formal contrast-ratio metric required.

#### Scenario: Manual legibility check
- GIVEN a screenshot of a screen displaying weight/reps/set numerals
- WHEN a reviewer views it at arm's length, simulating a mid-set glance
- THEN the numerals MUST be readable without zooming

### Requirement: Audit Commit Prerequisite

Implementation of this change MUST begin from a completed `audit-dark-form-surface-contrast` commit that owns the shared button disabled-state presentation. This change MUST NOT redefine that button treatment.

#### Scenario: Audit commit is the implementation base
- GIVEN implementation of `shared-form-state-contrast` is about to begin
- WHEN the base revision is inspected
- THEN the completed `audit-dark-form-surface-contrast` commit MUST be an ancestor
- AND its shared button disabled-state presentation MUST remain outside this delta

### Requirement: Shared Form State Presentation

Shared command, input, select, and textarea primitives, plus affected exercise and workout forms, MUST present placeholder, invalid, disabled, and icon states consistently and distinctly. Disabled controls MUST remain legible while visibly attenuated. Conformance SHALL be assessed qualitatively; no numeric contrast ratio is prescribed.

#### Scenario: Placeholder and icon states are recognizable
- GIVEN an affected form displays placeholder text or a supporting form icon
- WHEN the control is enabled and has no entered value
- THEN placeholder and icon presentation MUST be visually consistent across shared primitives
- AND each MUST remain distinguishable from entered content

#### Scenario: Existing invalid state is presented
- GIVEN existing validation marks a shared control invalid
- WHEN the affected form renders that control
- THEN the control MUST display a distinct invalid presentation
- AND validation output and accessibility state MUST remain unchanged

#### Scenario: Disabled controls remain legible and attenuated
- GIVEN a shared control, command item, or affected form action is disabled
- WHEN the disabled state is rendered
- THEN its content and state MUST remain legible
- AND its presentation MUST be visibly attenuated relative to the enabled state

#### Scenario: Mixed states preserve semantic distinction
- GIVEN an affected form contains enabled, invalid, and disabled controls together
- WHEN the form is viewed without interaction
- THEN each state MUST remain visually distinguishable from the others

### Requirement: Tailwind ESM Runtime Configuration

`tailwind.config.ts` MUST load `tailwindcss/defaultTheme` and `tailwindcss-animate` through typed ESM imports. The correction MUST retain the existing default-theme font-family extension and animation plugin behavior; it MUST NOT redesign tokens, content globs, theme extensions, or plugin configuration.

#### Scenario: Next loads Tailwind configuration as ESM
- GIVEN Next compiles a route that requires Tailwind configuration, including `/workouts/create`
- WHEN `tailwind.config.ts` is evaluated by its ESM runtime loader
- THEN configuration evaluation MUST complete without `ReferenceError: require is not defined`
- AND the production build MUST complete successfully

#### Scenario: Existing Tailwind configuration behavior is retained
- GIVEN the ESM-corrected Tailwind configuration
- WHEN the resolved theme and plugins are consumed by Tailwind
- THEN `fontFamily.sans` and `fontFamily.display` MUST continue to extend the default theme with their existing variables
- AND the existing `tailwindcss-animate` plugin MUST remain configured

### Requirement: Presentation-Only Boundary

The rollout MUST NOT change validation rules, form values, submission behavior, data access, persisted data, routes, middleware, server actions, events, accessibility wiring, or Radix/shadcn component behavior. Presentation MAY respond only to state signals already produced by the existing form and primitive boundaries. The sole non-presentation exception is the import-only ESM correction in `tailwind.config.ts`, which MUST preserve existing configuration behavior.

(Previously: The boundary prohibited server-action, data-layer, route, middleware, and component-behavior changes without explicitly covering validation, values, submission, events, persisted data, or accessibility wiring.)

#### Scenario: No logic diff
- GIVEN the full change is complete
- WHEN running `git diff` against `src/actions/`, `src/data/`, `prisma/`, `middleware.ts`, route handlers
- THEN the diff is empty

#### Scenario: Form behavior is preserved
- GIVEN an affected form before and after normalized styling
- WHEN the same input, validation, submission, and keyboard interactions are performed
- THEN observable behavior and resulting data MUST remain unchanged

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
