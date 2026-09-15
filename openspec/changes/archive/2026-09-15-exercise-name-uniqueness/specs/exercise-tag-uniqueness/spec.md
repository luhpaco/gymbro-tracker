# Delta for Exercise Tag Uniqueness

## MODIFIED Requirements

### Requirement: Composite per-user tag uniqueness constraint

The data layer MUST enforce owner-scoped canonical-name uniqueness atomically. It MUST NOT enforce global exercise-name uniqueness.
(Previously: A composite `(userId, tag)` constraint coexisted with global `name` uniqueness.)

#### Scenario: Scoped constraint is migrated

- GIVEN the exercise schema and applied migrations
- WHEN uniqueness constraints are inspected
- THEN canonical identity is unique per owner and name is not globally unique

#### Scenario: Database rejects only same-owner duplicates

- GIVEN an exercise holds a canonical identity
- WHEN duplicate rows are written for the same owner and for another owner
- THEN only the same-owner write violates uniqueness

### Requirement: Atomic backstop under concurrent creates

Concurrent creates or renames MUST NOT produce duplicate canonical identities for one owner. A losing mutation MUST return `{ ok: false, code: "duplicate_name" }` without escaping the action contract.
(Previously: The backstop covered only concurrent creates sharing `(userId, tag)`.)

#### Scenario: Concurrent mutations conflict

- GIVEN same-owner mutations target one canonical identity after pre-checks pass
- WHEN both writes reach the database
- THEN exactly one resulting row holds that identity
- AND the loser returns `duplicate_name`

### Requirement: P2002 target normalization

Create and rename actions MUST map only the owner-scoped canonical-identity constraint violation to `duplicate_name`; any other P2002 target MUST map to `error`.
(Previously: Only create mapped the composite tag constraint to `duplicate_tag`.)

#### Scenario: Canonical target maps to duplicate_name

- GIVEN create or rename receives P2002 for the canonical-identity constraint
- WHEN the action handles it
- THEN it returns `{ ok: false, code: "duplicate_name" }`

#### Scenario: Other target maps to error

- GIVEN create or rename receives P2002 for another target
- WHEN the action handles it
- THEN it returns `{ ok: false, code: "error" }`

### Requirement: Pre-check fast path retained

Create and rename MUST use an owner-scoped conflict pre-check before writing; rename MUST exclude its target row. The database constraint MUST remain the atomic backstop.
(Previously: The pre-check covered create-time `(userId, tag)` collisions only.)

#### Scenario: Pre-check short-circuits without write

- GIVEN another owned exercise holds the requested canonical identity
- WHEN create or rename performs its pre-check
- THEN it returns `duplicate_name` without writing

#### Scenario: Rename excludes itself

- GIVEN only the target exercise holds its canonical identity
- WHEN its rename pre-check runs
- THEN the action proceeds
