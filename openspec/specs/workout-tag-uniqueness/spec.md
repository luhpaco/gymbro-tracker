# Workout Tag Uniqueness Specification

## Purpose

Owner-scoped `Workout.tag` uniqueness with non-blocking collision resolution: a composite per-user unique
constraint replaces the global one, same-owner collisions are resolved by a bounded disambiguating-suffix
retry driven by the database constraint itself, and only that exact constraint violation is retried — so a
workout is never refused because another workout shares its name and date while the bounded retry still
finds a free suffix. Exhausting that bound is the one documented exception: it returns `duplicate_tag`
instead of saving (see "Exhausting the retry bound returns a specific failure code").

This capability deliberately parallels `exercise-tag-uniqueness`, borrowing its mechanism (composite
per-user unique constraint plus targeted P2002 mapping) but not its blocking behavior: two sessions with
the same name on one day are legitimate, whereas two exercises with the same name are redundant.

## Requirements

### Requirement: Owner-scoped tag uniqueness constraint

The data layer MUST enforce workout tag uniqueness scoped to the owning user. It MUST NOT enforce global
workout tag uniqueness. Two different users MUST be able to hold the same tag simultaneously.

#### Scenario: Scoped constraint replaces the global one

- GIVEN the workout schema and its applied migrations
- WHEN the uniqueness constraints on `Workout` are inspected
- THEN the tag is unique per owner
- AND the tag is not globally unique

#### Scenario: Cross-user collision is allowed

- GIVEN user A has saved a workout named "Día de pierna" dated today
- WHEN user B saves a workout with the same name and the same date
- THEN both workouts persist
- AND neither save is refused

#### Scenario: Same-owner duplicate violates the constraint

- GIVEN a workout with a given tag exists for one owner
- WHEN a second row with that exact owner and tag is written
- THEN the write violates the uniqueness constraint

### Requirement: Base tag is server-derived and immutable

The base tag MUST be derived server-side from the workout name and date using the existing formula, and
the client-supplied tag field MUST be ignored. Once a workout is created, its stored tag MUST NOT be
recomputed, so existing URLs remain valid.

#### Scenario: Base tag follows the existing formula

- GIVEN a submission with a workout name and date
- WHEN the workout is created without any collision
- THEN the persisted tag equals the existing derivation from that name and date
- AND it carries no disambiguating suffix

#### Scenario: Client-supplied tag is ignored

- GIVEN a submission whose client-supplied tag field holds an arbitrary value
- WHEN the workout is created
- THEN the persisted tag is the server-derived value
- AND the client-supplied value is not persisted

#### Scenario: Stored tag is never recomputed

- GIVEN an existing workout with a stored tag
- WHEN any other operation in this change reads or writes that workout
- THEN the stored tag is unchanged

### Requirement: Same-owner collisions resolve without refusing the save

A same-owner tag collision MUST be resolved by retrying the create with a disambiguating suffix appended
to the base tag — `-2`, then `-3`, and so on — up to a bounded, fixed maximum number of attempts. The
action MUST NOT refuse a legitimate save within that bound, MUST NOT perform an existence pre-check
before writing (the database constraint is the single source of truth, so there is no check-to-create
race), and MUST NOT alter the workout name the user typed. Only the tag is disambiguated.

#### Scenario: First same-owner collision resolves with suffix -2

- GIVEN one owner already has a workout whose tag is the base tag
- WHEN that owner saves a second workout with the same name and date
- THEN the first create attempt violates the owner-scoped constraint
- AND the action retries and persists the workout with the base tag suffixed `-2`
- AND it returns a successful result

#### Scenario: Second same-owner collision resolves with suffix -3

- GIVEN one owner already holds both the base tag and the base tag suffixed `-2`
- WHEN that owner saves a third workout with the same name and date
- THEN the workout persists with the base tag suffixed `-3`
- AND it returns a successful result

#### Scenario: Both workouts stay retrievable at distinct addresses

- GIVEN one owner saved two workouts with the same name and date
- WHEN each is looked up by its own tag
- THEN each resolves to its own workout
- AND their tags differ

#### Scenario: The workout name is never modified

- GIVEN a save that required a disambiguating suffix
- WHEN the persisted workout is read
- THEN its name is exactly the name the user typed, with no suffix

#### Scenario: No pre-check query is issued

- GIVEN a save with no collision
- WHEN the action runs
- THEN it performs exactly one create attempt
- AND it issues no prior lookup for an existing tag

#### Scenario: Each retry starts from a clean state

- GIVEN a create attempt with nested sets fails on the owner-scoped constraint
- WHEN the retry runs
- THEN no partial workout or set rows from the failed attempt remain

### Requirement: Only the owner-scoped tag constraint is retried

The action MUST retry only when the uniqueness violation targets exactly the owner-scoped tag constraint.
A uniqueness violation on any other target MUST NOT be retried and MUST map to the generic failure code.
Any non-uniqueness database error MUST also map to the generic failure code.

#### Scenario: Unrelated uniqueness violation is not swallowed

- GIVEN the create fails with a uniqueness violation whose target is not the owner-scoped tag constraint
- WHEN the action handles it
- THEN it returns `{ ok: false, code: "error" }`
- AND it performs no retry

#### Scenario: Generic database error maps to error

- GIVEN the create fails with a database error that is not a uniqueness violation
- WHEN the action handles it
- THEN it returns `{ ok: false, code: "error" }`
- AND it performs no retry

### Requirement: Exhausting the retry bound returns a specific failure code

When every attempt within the bound collides on the owner-scoped tag constraint, the action MUST return a
dedicated `duplicate_tag` failure code. It MUST NOT return the generic `error` code, whose message advises
the user to retry — advice that could never succeed on this path. The number of create attempts MUST NOT
exceed the bound.

#### Scenario: Bound exhaustion returns duplicate_tag

- GIVEN every create attempt within the bound violates the owner-scoped tag constraint
- WHEN the action finishes
- THEN it returns `{ ok: false, code: "duplicate_tag" }`

#### Scenario: Attempts are bounded

- GIVEN every create attempt violates the owner-scoped tag constraint
- WHEN the action finishes
- THEN the number of create attempts equals the configured bound and does not grow without limit

#### Scenario: Result contract carries the new code

- GIVEN the workout creation result type
- WHEN its failure codes are inspected
- THEN `duplicate_tag` is one of them alongside `unauthorized`, `invalid_input` and `error`

### Requirement: Tag lookup is owner-scoped

Looking a workout up by its tag MUST be scoped to the authenticated owner. It MUST NOT return another
user's workout that happens to hold the same tag.

#### Scenario: Each owner resolves their own workout

- GIVEN users A and B each hold a workout with the same tag
- WHEN each looks that tag up while authenticated
- THEN each receives their own workout

#### Scenario: A foreign tag does not resolve

- GIVEN only user B holds a given tag
- WHEN user A looks that tag up
- THEN no workout is returned to user A
