# Workouts Empty State Specification

## Purpose

Defines the persistent workout-creation CTA and the conditional empty-state message for the workouts list (`/workouts`), mirroring the proven exercises-route pattern. Scope is limited to `WorkoutsSection.tsx`; the section remains a server component.

## Requirements

### Requirement: Persistent Workout Creation CTA

The workouts list section SHALL render a `Crear entrenamiento` CTA above the workout list in every list state, linking to `/workouts/create`.

#### Scenario: CTA with workouts present

- GIVEN the user has at least one workout
- WHEN `/workouts` renders
- THEN a `Crear entrenamiento` button appears above the workout list
- AND it links to `/workouts/create`

#### Scenario: CTA with zero workouts

- GIVEN the user has no workouts
- WHEN `/workouts` renders
- THEN the `Crear entrenamiento` button still renders above the empty-state block

### Requirement: Workouts List Empty State

When the workouts list is empty, the section SHALL render a two-line empty-state message in neutral Spanish with an inline CTA link to `/workouts/create`. The message SHALL NOT reference filters or muscle groups.

#### Scenario: Empty list renders the empty state

- GIVEN the user has no workouts
- WHEN `/workouts` renders
- THEN the section shows the message `No has creado ningún entrenamiento todavía...`
- AND shows `¡Anímate a crear uno!` with `a crear uno!` as an inline, underlined, semibold link to `/workouts/create`
- AND no workout cards render

#### Scenario: Non-empty list renders cards only

- GIVEN the user has at least one workout
- WHEN `/workouts` renders
- THEN workout cards render exactly as before this change
- AND no empty-state message renders

#### Scenario: Copy stays generic

- GIVEN the user has no workouts
- WHEN the empty state renders
- THEN the copy refers only to workouts the user has created
- AND it does not mention filters, muscle groups, or search terms

### Requirement: Server Component Boundary

`WorkoutsSection` SHALL remain a server component. The persistent CTA and the empty-state link SHALL be server-rendered markup requiring no client-side JavaScript.

#### Scenario: No client directive or hooks

- GIVEN the implemented `WorkoutsSection.tsx`
- WHEN the file is inspected
- THEN it contains no `"use client"` directive and no React hooks or event handlers

#### Scenario: Build remains clean

- GIVEN the change is implemented
- WHEN `pnpm build` and `pnpm lint` run
- THEN both pass without errors
