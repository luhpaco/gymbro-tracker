# Delta for exercise-action-validation

## MODIFIED Requirements

### Requirement: Per-user tag uniqueness pre-check

The action MUST derive `tag` server-side (`name.toLowerCase().replace(/\s/g, "-")`), never from input. The `findFirst` pre-check MUST remain the fast path: when an existing exercise holds the derived `tag` for the same `userId`, the action MUST return `{ ok: false, code: "duplicate_tag" }` before attempting `create`. Per-user uniqueness MUST also hold atomically under concurrency, backed by the composite `(userId, tag)` constraint owned by the `exercise-tag-uniqueness` capability: a `create` that slips past the pre-check and violates that constraint MUST be caught as Prisma P2002 and returned as `{ ok: false, code: "duplicate_tag" }` — no exception MAY escape the union. Cross-user collisions are NOT checked by the pre-check; the global `name @unique` surfaces them as Prisma P2002, and a P2002 on any target other than the composite constraint MUST map to `{ ok: false, code: "error" }`.

(Previously: uniqueness relied solely on the non-atomic `findFirst` pre-check; every caught exception, including any P2002, mapped to `error`.)

#### Scenario: No collision creates

- GIVEN no existing exercise with the derived `tag` for this user
- WHEN the pre-check runs
- THEN the action creates the exercise

#### Scenario: Collision short-circuits

- GIVEN an existing exercise with the derived `tag` for this user
- WHEN the pre-check runs
- THEN the action returns `{ ok: false, code: "duplicate_tag" }` and no create occurs

#### Scenario: Concurrent insert races past the pre-check

- GIVEN two concurrent requests with the same `userId` and derived `tag`, both past the pre-check
- WHEN the second `create` violates the composite `(userId, tag)` constraint
- THEN the action returns `{ ok: false, code: "duplicate_tag" }` and no exception escapes the union

#### Scenario: Composite P2002 target maps to duplicate_tag

- GIVEN `create` throws Prisma P2002 whose `meta.target` is `["userId","tag"]` or `"Exercise_userId_tag_key"`
- WHEN the catch-all handles the error
- THEN the action returns `{ ok: false, code: "duplicate_tag" }`

#### Scenario: Cross-user name collision maps to error

- GIVEN another user's exercise already holds the same `name`
- WHEN the action attempts `create`
- THEN Prisma P2002 is caught and returned as `{ ok: false, code: "error" }`

#### Scenario: Non-composite P2002 target maps to error

- GIVEN `create` throws Prisma P2002 with any target other than the composite (e.g. `["name"]`)
- WHEN the catch-all handles the error
- THEN the action returns `{ ok: false, code: "error" }`
