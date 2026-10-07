# Saved Workout Set Management Specification

## Purpose

Let owners correct the contents of an existing workout by adding sets to its recorded exercises, deleting sets, and removing exercises with their sets, while keeping every saved exercise and workout nonempty.

## Requirements

### Requirement: Add sets to an exercise already recorded in the workout

An authenticated owner MUST be able to add valid sets to an exercise already present in their saved workout. The exercise MAY currently be inactive: deactivation MUST NOT discard its workout history or prevent additions to that recorded exercise. The system MUST NOT add a previously unrecorded exercise to the workout through this operation. Each new set MUST support the existing weight, repetitions and optional warmup rules; the owner MUST be able to see the added set on the saved workout.

#### Scenario: Add a working or warmup set after save

- GIVEN an owner has a saved workout containing an exercise
- WHEN the owner adds a valid set to that exercise with warmup set to `true` or `false`
- THEN the set is saved with its supplied warmup state
- AND the workout detail shows the new set

#### Scenario: Previously recorded inactive exercise still accepts sets

- GIVEN an exercise is already recorded in an owned workout but was deactivated afterwards
- WHEN the owner adds a valid set to that recorded exercise
- THEN the set is saved and appears with the exercise's existing workout history

#### Scenario: A new exercise is not added through set addition

- GIVEN an owned workout does not contain exercise B
- WHEN the owner requests set addition for exercise B through this operation
- THEN the action returns `{ ok: false, code: "not_found" }`
- AND the workout is unchanged

### Requirement: Confirm individual set and exercise removal

The owner MUST complete a two-tap inline confirmation before removing an individual set or an exercise from a saved workout. The first tap MUST only request confirmation and MUST NOT delete data; the second confirming tap MAY remove the selected item. Removing an exercise MUST also remove that exercise's sets from the selected workout, without changing other workouts or the exercise's saved history elsewhere. The controls MUST give clear feedback after confirmation or refusal.

#### Scenario: First tap leaves a set intact

- GIVEN an owner sees a saved set
- WHEN the owner taps its remove control once
- THEN the set is still saved
- AND an inline confirm action is available

#### Scenario: First tap leaves an exercise intact

- GIVEN an owner sees a saved exercise and its sets
- WHEN the owner taps its remove control once
- THEN the exercise and its sets are still saved
- AND an inline confirm action is available

#### Scenario: Confirm removing one set

- GIVEN an owned workout has an exercise with more than one set and its set-removal control awaits confirmation
- WHEN the owner confirms removal of one set
- THEN only the selected set is removed
- AND the remaining sets are shown for that exercise

#### Scenario: Confirm removing an exercise and its sets

- GIVEN an owned workout contains exercises A and B, and removal of A awaits confirmation
- WHEN the owner confirms removal of A
- THEN A and its sets no longer appear in that workout
- AND B and its sets remain unchanged
- AND A's history in other workouts remains unchanged

### Requirement: Preserve nonempty saved workouts

The system MUST refuse to remove the final set of any recorded exercise and MUST refuse to remove the final exercise of a saved workout. These refusal conditions MUST have distinct result codes `last_set` and `last_exercise` and an explanation in the UI; neither refusal MAY delete data. This includes the workout's final set and ensures that every remaining exercise has at least one set.

#### Scenario: Final set of a saved workout is blocked

- GIVEN an owned saved workout has one exercise with one set
- WHEN the owner confirms removal of that set
- THEN the action returns `{ ok: false, code: "last_set" }`
- AND the set and workout remain saved
- AND the UI explains why removal was refused

#### Scenario: Final set of one of several exercises is blocked

- GIVEN an owned workout has two exercises and one of them has just one set
- WHEN the owner confirms removal of that exercise's only set
- THEN the action returns `{ ok: false, code: "last_set" }`
- AND both exercises and their sets remain saved

#### Scenario: Final exercise is blocked

- GIVEN an owned workout has one exercise with multiple sets
- WHEN the owner confirms removal of that exercise
- THEN the action returns `{ ok: false, code: "last_exercise" }`
- AND the exercise and all its sets remain saved
- AND the UI explains why removal was refused

### Requirement: Validated and owner-isolated set mutations

Every new post-save set or exercise mutation MUST require an authenticated user and validate its input with Zod before any database write. The action MUST verify that the target workout and item belong to the caller's workout; a missing workout, foreign workout, missing set, foreign set, or exercise not recorded in that owned workout MUST return the same `not_found` code without disclosing existence. New actions MUST use coded results: `unauthorized`, `invalid_input`, `not_found`, `last_set` or `last_exercise` when applicable, and `error` for a failed write. Successful mutations MUST revalidate the saved workout's detail route and `/workouts`. Existing `updateSet` behavior and its codeless result MUST remain unchanged.

#### Scenario: No session blocks every new mutation

- GIVEN there is no authenticated user
- WHEN set addition, set deletion or exercise removal is requested
- THEN the action returns `{ ok: false, code: "unauthorized" }`
- AND no database write occurs

#### Scenario: Invalid addition is rejected before a write

- GIVEN an owner submits invalid set values or malformed identifiers
- WHEN set addition is requested
- THEN the action returns `{ ok: false, code: "invalid_input" }`
- AND no database write occurs

#### Scenario: Foreign and missing targets are indistinguishable

- GIVEN user A is authenticated and a set or workout belongs to user B
- WHEN A attempts to add to, remove a set from, or remove an exercise from B's workout, or targets nonexistent resources
- THEN each attempt returns `{ ok: false, code: "not_found" }`
- AND no set or exercise association is changed

#### Scenario: Unrelated set identifier does not affect an owned workout

- GIVEN user A owns a workout and a set identifier belongs to a different workout
- WHEN A requests deletion of that set from the owned workout
- THEN the action returns `{ ok: false, code: "not_found" }`
- AND neither workout changes

#### Scenario: Successful mutation refreshes both views

- GIVEN a valid owner request adds or removes a set or removes an exercise
- WHEN the mutation succeeds
- THEN the affected workout detail route and `/workouts` are revalidated

#### Scenario: Failed write does not report success

- GIVEN a valid owner request to add or remove a set or remove an exercise encounters a write failure
- WHEN the mutation completes
- THEN the action returns `{ ok: false, code: "error" }`
- AND the affected workout detail route and `/workouts` are not revalidated

### Requirement: Verifiable set corrections

Automated action tests MUST cover valid post-save additions and removals, warmups, ordering, invalid input, unauthenticated and foreign access, refusal at last-item boundaries, failed writes, and detail/list revalidation. The change MUST pass `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, and `pnpm exec tsc --noEmit` before delivery.

#### Scenario: Last-item and owner-isolation tests

- GIVEN the set-management action tests include owned, foreign, missing and final-item fixtures
- WHEN the tests run
- THEN foreign and missing resources give the same result
- AND final-item refusals preserve all previously saved data

#### Scenario: Delivery gates

- GIVEN the change is ready for delivery
- WHEN the configured test, build, lint, format-check and type-check commands run
- THEN all five commands pass