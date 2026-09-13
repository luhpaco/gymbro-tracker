# Exercise Action Validation Specification

## Purpose

Runtime validation of exercise creation: a shared Zod schema, a server action that parses input before any Prisma call, muscle-group existence and per-user tag-uniqueness pre-checks, a discriminated-union return contract, and explicit form handling of both union branches.

## Requirements

### Requirement: Shared Zod schema

The system MUST export `createExerciseSchema` and the inferred `CreateExerciseInput` type from `src/lib/schemas/exercise.ts`, validating DB-aligned keys: `name` (string, min 4 chars, message style matching the current form), `description` (optional string), `muscleGroupTag` (string, min 1 char). The schema MUST be syntactic only — muscle-group existence is enforced by a separate action-side pre-check, not by the schema — keeping the schema unit-testable without a database. The schema MUST NOT accept `tag` as input.

#### Scenario: Valid input parses

- GIVEN input `{ name: "Press banca", description: "Barra", muscleGroupTag: "chest" }`
- WHEN `createExerciseSchema.safeParse` runs
- THEN parsing succeeds

#### Scenario: Name too short is rejected

- GIVEN input with `name` shorter than 4 characters
- WHEN `safeParse` runs
- THEN parsing fails with a `name` error

#### Scenario: Empty muscle-group tag is rejected

- GIVEN input with `muscleGroupTag: ""`
- WHEN `safeParse` runs
- THEN parsing fails with a `muscleGroupTag` error

#### Scenario: Missing required field is rejected

- GIVEN input missing `name`
- WHEN `safeParse` runs
- THEN parsing fails

### Requirement: Runtime parse before any Prisma call

`createExercise` MUST call `safeParse` on its input BEFORE any Prisma call. On parse failure it MUST return `{ ok: false, code: "invalid_input" }` without touching the database.

#### Scenario: Invalid input short-circuits

- GIVEN input that fails schema parsing (e.g. `name` too short)
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "invalid_input" }` and no `prisma.exercise.create` call occurs

#### Scenario: Valid input proceeds

- GIVEN input that parses successfully
- WHEN `createExercise` runs
- THEN it proceeds to muscle-group and tag-uniqueness checks

### Requirement: Muscle-group existence pre-check

When input parses, the action MUST verify `muscleGroupTag` exists in the `MuscleGroup` table before creating; otherwise it MUST return `{ ok: false, code: "unknown_muscle_group" }`.

#### Scenario: Known tag proceeds

- GIVEN parsed input whose `muscleGroupTag` exists in `MuscleGroup`
- WHEN the pre-check runs
- THEN the action proceeds to the tag-uniqueness check

#### Scenario: Unknown tag short-circuits

- GIVEN parsed input whose `muscleGroupTag` does not exist
- WHEN the pre-check runs
- THEN the action returns `{ ok: false, code: "unknown_muscle_group" }` and no create occurs

### Requirement: Per-user tag uniqueness pre-check

The action MUST derive `tag` server-side (`name.toLowerCase().replace(/\s/g, "-")`), never from input, and MUST verify no existing exercise has that `tag` for the same `userId` before creating; on collision it MUST return `{ ok: false, code: "duplicate_tag" }`. Cross-user collisions are NOT checked here; the global `name @unique` constraint surfaces cross-user name collisions as Prisma P2002.

#### Scenario: No collision creates

- GIVEN no existing exercise with the derived `tag` for this user
- WHEN the pre-check runs
- THEN the action creates the exercise

#### Scenario: Collision short-circuits

- GIVEN an existing exercise with the derived `tag` for this user
- WHEN the pre-check runs
- THEN the action returns `{ ok: false, code: "duplicate_tag" }` and no create occurs

#### Scenario: Cross-user name collision maps to error

- GIVEN another user's exercise already holds the same `name`
- WHEN the action attempts `create`
- THEN Prisma P2002 is caught and returned as `{ ok: false, code: "error" }`

### Requirement: Discriminated-union return

`createExercise` MUST return exactly one of: `{ ok: true, exercise: Exercise }` on success; `{ ok: false, code }` where `code` is `unauthorized` (missing session), `invalid_input` (parse failure), `unknown_muscle_group`, `duplicate_tag`, or `error` (catch-all covering Prisma P2002 and any other DB error). The action MUST NOT return `undefined` or swallow errors.

#### Scenario: Success

- GIVEN valid input with all pre-checks passing
- WHEN `createExercise` runs
- THEN it returns `{ ok: true, exercise }` with the created row

#### Scenario: Unauthorized

- GIVEN no session
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "unauthorized" }`

#### Scenario: Invalid input

- GIVEN malformed input
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "invalid_input" }`

#### Scenario: Unknown muscle group

- GIVEN parsed input with an unknown muscle-group tag
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "unknown_muscle_group" }`

#### Scenario: Duplicate tag

- GIVEN a per-user tag collision
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "duplicate_tag" }`

#### Scenario: Error catch-all

- GIVEN a Prisma P2002 or other DB error during create
- WHEN `createExercise` runs
- THEN it returns `{ ok: false, code: "error" }`

### Requirement: Form handles the discriminated union

`CreateExerciseForm` MUST handle both union branches explicitly. On `ok: true` it MUST show the success toast, call `form.reset()`, and `router.push("/exercises")` (current behavior, preserved). On `ok: false` it MUST show a destructive toast whose message is selected by `code` (Spanish messages, per the project's existing form toasts); the success toast MUST NOT appear on any failure code. On submit it MUST map UI field `exerciseName` → `name` and `muscleGroup` → `muscleGroupTag`.

#### Scenario: Success branch

- GIVEN the action returns `{ ok: true, exercise }`
- WHEN the form handles the result
- THEN it shows the success toast, resets, and redirects to `/exercises`

#### Scenario: Error branch per code

- GIVEN the action returns `{ ok: false, code }` for any of the five codes
- WHEN the form handles the result
- THEN it shows a destructive toast with the code-specific message, no success toast, and the form remains editable

#### Scenario: Field mapping on submit

- GIVEN the form fields `exerciseName` and `muscleGroup`
- WHEN the user submits
- THEN the action receives `{ name, muscleGroupTag }` keys
