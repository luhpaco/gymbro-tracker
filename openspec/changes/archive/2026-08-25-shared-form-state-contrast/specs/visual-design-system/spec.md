# Delta for Visual Design System

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Presentation-Only Boundary

The rollout MUST NOT change validation rules, form values, submission behavior, data access, persisted data, routes, middleware, server actions, events, accessibility wiring, or Radix/shadcn component behavior. Presentation MAY respond only to state signals already produced by the existing form and primitive boundaries. The sole non-presentation exception is the import-only ESM correction in `tailwind.config.ts`, which MUST preserve existing configuration behavior.

(Previously: The boundary prohibited server-action, data-layer, route, middleware, and component-behavior changes without explicitly covering validation, values, submission, events, persisted data, or accessibility wiring.)

#### Scenario: No logic diff

- GIVEN the full change is complete
- WHEN the diff is inspected across product code
- THEN changes MUST be limited to presentation of existing component and form states plus the import-only Tailwind ESM runtime correction
- AND validation, data, routing, server-action, event, and accessibility behavior MUST remain unchanged

#### Scenario: Validation behavior is preserved

- GIVEN the same invalid form input before and after this change
- WHEN validation and submission are attempted
- THEN the same validation result and submission boundary MUST apply
- AND only the invalid-state presentation MAY differ
