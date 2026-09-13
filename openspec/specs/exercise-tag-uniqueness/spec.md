# Exercise Tag Uniqueness Specification

## Purpose

Atomic per-user exercise tag uniqueness: a database-level composite unique constraint on `Exercise (userId, tag)` backs the action-level pre-check, closing the check-to-create race window, with caught Prisma P2002 errors mapped by target.

## Requirements

### Requirement: Composite per-user tag uniqueness constraint

The data layer MUST enforce per-user tag uniqueness via a composite unique constraint on `Exercise (userId, tag)`, materialized by a Prisma migration as the unique index `Exercise_userId_tag_key`. The global `name @unique` constraint MUST remain unchanged.

#### Scenario: Constraint declared and migrated

- GIVEN `prisma/schema.prisma` and its applied migrations
- WHEN the `Exercise` model is inspected
- THEN it declares `@@unique([userId, tag])` alongside the unchanged `name @unique`
- AND a migration creates the unique index `Exercise_userId_tag_key`

#### Scenario: Database rejects duplicate tag rows

- GIVEN an exercise row exists for a `(userId, tag)` pair
- WHEN a second row with the same pair is inserted at the database layer
- THEN the insert fails with a unique-constraint violation

### Requirement: Atomic backstop under concurrent creates

`createExercise` MUST NOT produce two exercises with the same `(userId, tag)` when concurrent requests both pass the pre-check. The request that loses the race MUST receive `{ ok: false, code: "duplicate_tag" }`; no exception MAY escape the action's discriminated union.

#### Scenario: Concurrent same-tag inserts

- GIVEN two concurrent `createExercise` requests with the same `userId` and derived `tag`, both passing the pre-check
- WHEN both attempts reach the database create
- THEN exactly one exercise row is created
- AND the losing request returns `{ ok: false, code: "duplicate_tag" }`

### Requirement: P2002 target normalization

The action MUST map a caught Prisma P2002 to `{ ok: false, code: "duplicate_tag" }` if and only if its `meta.target` identifies the composite constraint — the array form `["userId","tag"]` or the constraint-name string `"Exercise_userId_tag_key"`. Any other P2002 target MUST map to `{ ok: false, code: "error" }`.

#### Scenario: Array target maps to duplicate_tag

- GIVEN `create` throws Prisma P2002 with `meta.target` `["userId","tag"]`
- WHEN the catch-all handles the error
- THEN the action returns `{ ok: false, code: "duplicate_tag" }`

#### Scenario: Constraint-name target maps to duplicate_tag

- GIVEN `create` throws Prisma P2002 with `meta.target` `"Exercise_userId_tag_key"`
- WHEN the catch-all handles the error
- THEN the action returns `{ ok: false, code: "duplicate_tag" }`

#### Scenario: Other target maps to error

- GIVEN `create` throws Prisma P2002 with any other target (e.g. `["name"]`)
- WHEN the catch-all handles the error
- THEN the action returns `{ ok: false, code: "error" }`

### Requirement: Pre-check fast path retained

The `findFirst` pre-check MUST remain the primary route: a detected collision short-circuits to `{ ok: false, code: "duplicate_tag" }` before `create`, without an exception round-trip. The composite constraint serves as the backstop, not the primary path.

#### Scenario: Pre-check short-circuits without exception

- GIVEN an existing exercise with the derived `tag` for this user
- WHEN the pre-check runs
- THEN the action returns `{ ok: false, code: "duplicate_tag" }` without invoking `create`
