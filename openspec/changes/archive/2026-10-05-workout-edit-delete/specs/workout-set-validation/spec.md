# Delta for Workout Set Validation

## MODIFIED Requirements

### Requirement: Single shared set schema

The system MUST define the set validation rules exactly once and apply the identical rules everywhere a set is validated — workout creation, set update, post-save set addition, and the creation form's per-field validators. Every new post-save mutation MUST validate its input with Zod before any database write. It MUST NOT maintain independent set schema definitions that can drift apart. The existing `updateSet` action's codeless result contract MUST remain unchanged.

(Previously: Shared validation applied to workout creation, set update and creation-form fields, but not post-save additions.)

#### Scenario: Both entry points enforce identical rules

- GIVEN the same set value
- WHEN it is validated through the workout schema and through the standalone set schema
- THEN both produce the same accept-or-reject outcome for every rule in this specification

#### Scenario: Form field validators inherit the shared rules

- GIVEN the creation form builds its weight and repetition field validators from the shared set schema
- WHEN the shared rules change
- THEN the form's field-level validation reflects the changed rules without a separate definition

#### Scenario: Post-save addition uses the same rules

- GIVEN identical valid or invalid weight, repetitions and warmup values
- WHEN each value is checked for creation and for post-save set addition
- THEN both paths accept or reject that value according to the same set rules
- AND an invalid addition returns `invalid_input` before any database write

### Requirement: No upper bound on sets per exercise

An exercise MUST carry at least one set in a saved workout and MUST NOT be subject to any upper bound on the number of sets, whether sets are submitted during creation or added afterwards. Submitting more than five sets for one exercise MUST validate and persist. Post-save removal of an exercise's final set MUST be refused with `last_set` so the exercise cannot remain empty.

(Previously: At least one set and no upper bound were enforced on workout creation; no post-save additions or removals existed.)

#### Scenario: Six sets are accepted

- GIVEN an exercise carrying six sets
- WHEN the workout is validated
- THEN validation succeeds

#### Scenario: Twenty sets are accepted

- GIVEN an exercise carrying twenty sets
- WHEN the workout is validated
- THEN validation succeeds
- AND all twenty sets persist

#### Scenario: Zero sets are rejected

- GIVEN an exercise carrying an empty set list
- WHEN the workout is validated
- THEN validation fails with a sets error

#### Scenario: More than five sets after saving

- GIVEN an owned saved workout has an exercise with five sets
- WHEN its owner adds a valid sixth set to that exercise
- THEN the addition succeeds and all six sets remain saved

#### Scenario: Removing an exercise's only set is refused

- GIVEN a saved workout has an exercise containing only one set
- WHEN its owner attempts to remove that set
- THEN the action returns `{ ok: false, code: "last_set" }`
- AND that exercise retains its set

### Requirement: At least one exercise per workout

A workout MUST carry at least one exercise both at creation and after post-save corrections. A creation submission with an empty exercise list MUST be rejected by validation before any database write. Post-save removal of the final exercise MUST be refused with `last_exercise`; deleting the whole workout after explicit confirmation remains a separate operation.

(Previously: The minimum of one exercise was validated at creation only; no post-save removal existed.)

#### Scenario: Zero exercises are rejected

- GIVEN a submission whose exercise list is empty
- WHEN the workout is validated
- THEN validation fails with an exercise-list error
- AND no workout is written

#### Scenario: One exercise with one set is accepted

- GIVEN a submission with one exercise carrying one valid set
- WHEN the workout is validated
- THEN validation succeeds

#### Scenario: Last exercise cannot be removed after save

- GIVEN an owned saved workout contains exactly one exercise
- WHEN its owner attempts to remove that exercise
- THEN the action returns `{ ok: false, code: "last_exercise" }`
- AND the workout and all its sets remain unchanged

#### Scenario: One of several exercises can be removed

- GIVEN an owned saved workout contains two exercises, each with at least one set
- WHEN its owner removes one of those exercises
- THEN the workout retains the other exercise and all of its sets
