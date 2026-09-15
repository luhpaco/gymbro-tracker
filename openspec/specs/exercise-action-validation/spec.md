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

`createExercise` MUST derive canonical identity using the shared normalization rule and MUST pre-check only the authenticated owner's exercises, including inactive rows. A collision MUST return `duplicate_name`; cross-owner reuse MUST proceed. Database conflicts MUST be handled identically.
(Previously: The action derived a whitespace-to-hyphen tag, returned `duplicate_tag`, and global name collisions became `error`.)

#### Scenario: No collision creates

- GIVEN no owned exercise has the canonical identity
- WHEN the pre-check runs
- THEN creation proceeds

#### Scenario: Owned collision short-circuits

- GIVEN an owned exercise, active or inactive, has the identity
- WHEN the pre-check runs
- THEN it returns `duplicate_name` without creating

#### Scenario: Concurrent insert races past pre-check

- GIVEN same-owner requests pass the pre-check
- WHEN one violates the atomic identity constraint
- THEN it returns `duplicate_name` without escaping

#### Scenario: Canonical P2002 maps to duplicate_name

- GIVEN create receives P2002 for the canonical identity constraint
- WHEN the error is handled
- THEN it returns `duplicate_name`

#### Scenario: Cross-owner name reuse proceeds

- GIVEN another owner holds the canonical identity
- WHEN create runs
- THEN creation succeeds if all other checks pass

#### Scenario: Other P2002 maps to error

- GIVEN create receives P2002 for another target
- WHEN the error is handled
- THEN it returns `error`

### Requirement: Discriminated-union return

`createExercise` MUST return success with an exercise or failure with `unauthorized`, `invalid_input`, `unknown_muscle_group`, `duplicate_name`, or `error`. It MUST NOT return `undefined` or swallow errors.
(Previously: The duplicate failure code was `duplicate_tag`.)

#### Scenario: Success
- GIVEN valid non-conflicting input
- WHEN creation runs
- THEN it returns `{ ok: true, exercise }`

#### Scenario: Unauthorized
- GIVEN no session
- WHEN creation runs
- THEN it returns `unauthorized`

#### Scenario: Invalid input
- GIVEN malformed input
- WHEN creation runs
- THEN it returns `invalid_input`

#### Scenario: Unknown muscle group
- GIVEN an unknown muscle group
- WHEN creation runs
- THEN it returns `unknown_muscle_group`

#### Scenario: Duplicate name
- GIVEN an owned normalized-name collision
- WHEN creation runs
- THEN it returns `duplicate_name`

#### Scenario: Error catch-all
- GIVEN another database error
- WHEN creation runs
- THEN it returns `error`

### Requirement: Form handles the discriminated union

Create and update forms MUST show success behavior only for successful actions. Every failure MUST show code-specific destructive feedback, keep the form editable, and describe normalized-name conflicts as duplicate names.
(Previously: Only the create form handled five creation codes, including `duplicate_tag`.)

#### Scenario: Success branch
- GIVEN an action succeeds
- WHEN its form handles the result
- THEN it performs that form's existing success flow

#### Scenario: Error branch per code
- GIVEN an action returns any failure code
- WHEN its form handles the result
- THEN it shows destructive code-specific feedback and remains editable

#### Scenario: Field mapping on create
- GIVEN the create form fields
- WHEN submitted
- THEN the action receives `name` and `muscleGroupTag`

#### Scenario: Rename duplicate feedback
- GIVEN rename returns `duplicate_name`
- WHEN the update form handles it
- THEN it identifies the name conflict without reporting success
### Requirement: Validated and authorized rename

`updateExercise` MUST validate session, input, ownership, and name conflict before writing. It MUST return success with the updated exercise or failure code `unauthorized`, `invalid_input`, `not_found`, `duplicate_name`, or `error`; failure MUST NOT write. Success MUST persist display name and canonical identity together.

#### Scenario: Valid owner rename succeeds

- GIVEN an authenticated owner supplies valid, non-conflicting rename input
- WHEN the rename action runs
- THEN it returns the updated exercise with name and identity persisted together

#### Scenario: Invalid or unauthorized rename does not write

- GIVEN the session, input, or ownership check fails
- WHEN the rename action runs
- THEN it returns the corresponding failure and performs no write

