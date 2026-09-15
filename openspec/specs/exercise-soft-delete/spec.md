# Exercise Soft-Delete Specification

## Purpose

Active/inactive lifecycle for exercises: an `isActive` schema flag, active-only read paths, a toggle server action, and a deactivate UI — retiring exercises from lists and pickers while preserving `Set` history.

## Requirements

### Requirement: Active Flag on Exercise Schema

The `Exercise` model MUST define `isActive Boolean @default(true)`. The migration MUST add the column as `BOOLEAN NOT NULL DEFAULT true` so every pre-existing row reads back active.

#### Scenario: Pre-existing rows stay active

- GIVEN `Exercise` rows created before the migration
- WHEN the migration applies
- THEN every row reads back `isActive: true`

#### Scenario: New exercises default to active

- GIVEN an exercise created without an explicit `isActive` value
- WHEN the row is stored
- THEN `isActive` is `true`

### Requirement: Active-Only Read Paths

`getExercises` and `getExercisesSummary` MUST return only rows with `isActive: true` for the requesting user. The filter MUST live in the server actions, not the client store. Inactive exercises therefore MUST NOT appear in the `/workouts/create` exercise picker — intended behavior.

#### Scenario: Inactive exercises excluded from /exercises

- GIVEN the user owns one active and one inactive exercise
- WHEN `getExercises` runs
- THEN only the active exercise is returned

#### Scenario: Inactive exercises excluded from the summary

- GIVEN the user owns active and inactive exercises
- WHEN `getExercisesSummary` runs
- THEN only active exercises are returned

#### Scenario: Inactive exercises not selectable for workouts

- GIVEN the user owns an inactive exercise
- WHEN the `/workouts/create` picker renders from `getExercises`
- THEN the inactive exercise is not offered

### Requirement: Toggle Action Contract

`setExerciseActiveState({ id, isActive })` MUST validate in order: session → Zod → ownership → update. The system MUST export `exerciseActiveStateSchema` from `src/lib/schemas/exercise.ts`, requiring `id` (non-empty string) and `isActive` (boolean). The action MUST return `{ ok: true, exercise: Exercise }` with the updated row, or `{ ok: false, code }` where `code` is `unauthorized`, `invalid_input`, `not_found` (row missing or owned by another user), or `error`. Auth or parse failure MUST NOT touch the database. On success the action MUST call `revalidatePath("/exercises")`. Deactivation and reactivation MUST both work server-side; only the reactivation UI is deferred.

#### Scenario: Deactivation succeeds

- GIVEN an authenticated owner of exercise `id`
- WHEN the action runs with `isActive: false`
- THEN it returns `{ ok: true, exercise }` with `isActive: false`
- AND `/exercises` is revalidated

#### Scenario: Reactivation succeeds

- GIVEN an authenticated owner of an inactive exercise
- WHEN the action runs with `isActive: true`
- THEN it returns `{ ok: true, exercise }` with `isActive: true`

#### Scenario: Unauthorized rejects without DB access

- GIVEN no session
- WHEN the action runs
- THEN it returns `{ ok: false, code: "unauthorized" }` and no DB access occurs

#### Scenario: Invalid input rejects without DB write

- GIVEN input where `id` is empty or `isActive` is not a boolean
- WHEN the action runs
- THEN it returns `{ ok: false, code: "invalid_input" }` and no DB write occurs

#### Scenario: Not found or not owned

- GIVEN an `id` that does not exist or belongs to another user
- WHEN the action runs
- THEN it returns `{ ok: false, code: "not_found" }` and the row is unchanged

#### Scenario: Error catch-all

- GIVEN a database error during the update
- WHEN the action runs
- THEN it returns `{ ok: false, code: "error" }`

### Requirement: Set History Preservation

Deactivating an exercise MUST NOT delete or modify any `Set` rows referencing it. The `Set`→`Exercise` foreign key MUST remain unchanged; no cascade is added.

#### Scenario: Sets survive deactivation

- GIVEN an exercise with recorded `Set` rows
- WHEN the exercise is deactivated
- THEN every `Set` row still exists with unmodified values

### Requirement: Deactivate Control in ExerciseSection

Each exercise card in `ExerciseSection` MUST expose a destructive deactivate control. On success the card MUST disappear after the page refreshes. On failure a destructive toast MUST be shown and the card MUST remain.

#### Scenario: Success removes the card

- GIVEN the user triggers the deactivate control on a card
- WHEN the action returns `ok: true` and the page refreshes
- THEN the card is no longer rendered

#### Scenario: Failure keeps the card and shows a toast

- GIVEN the action returns `ok: false` for any code
- WHEN the result is handled
- THEN a destructive toast is shown and the card remains rendered

### Requirement: Name Uniqueness Unaffected

Deactivation MUST NOT release an exercise's owner-scoped canonical identity. The owner MUST reactivate or rename the existing row before reusing that identity; another owner MAY use it. Reactivation MUST preserve the existing row and history.
(Previously: Inactive names remained reserved globally.)

#### Scenario: Same-owner creation fails while inactive

- GIVEN an inactive exercise holds the owner's canonical identity
- WHEN that owner creates an equivalent name
- THEN creation returns duplicate-name feedback

#### Scenario: Another owner may reuse the name

- GIVEN an inactive exercise holds one owner's canonical identity
- WHEN another owner creates an equivalent name
- THEN creation succeeds

#### Scenario: Reactivation restores the exercise

- GIVEN the owner's exercise is inactive
- WHEN the owner reactivates it
- THEN the existing row reappears with its history preserved
