# Workout Set Validation Specification

## Purpose

The validation rules governing a workout's exercises and sets: one shared set schema, a weight rule that
admits bodyweight exercises without silently accepting blank input, an integer repetition rule, no upper
bound on sets per exercise, and a warmup flag that defaults safely so previously stored drafts remain
loadable.

## Requirements

### Requirement: Single shared set schema

The system MUST define the set validation rules exactly once and apply the identical rules everywhere a
set is validated — workout creation, set update, and the creation form's per-field validators. It MUST
NOT maintain two independent set schema definitions that can drift apart.

#### Scenario: Both entry points enforce identical rules

- GIVEN the same set value
- WHEN it is validated through the workout schema and through the standalone set schema
- THEN both produce the same accept-or-reject outcome for every rule in this specification

#### Scenario: Form field validators inherit the shared rules

- GIVEN the creation form builds its weight and repetition field validators from the shared set schema
- WHEN the shared rules change
- THEN the form's field-level validation reflects the changed rules without a separate definition

### Requirement: Weight accepts zero and rejects absent or non-finite input

A set's weight MUST be accepted when it is a finite number greater than or equal to `0`, so bodyweight
exercises are recordable. Blank, `null` and `undefined` weight MUST be rejected BEFORE any numeric
coercion, so an empty field never silently persists as `0`. Negative and non-finite values MUST be
rejected. Non-numeric text MUST be rejected.

#### Scenario: Zero weight is accepted

- GIVEN a set with weight `0` and repetitions `1`
- WHEN it is validated
- THEN validation succeeds

#### Scenario: Positive and fractional weight is accepted

- GIVEN a set with weight `42.5`
- WHEN it is validated
- THEN validation succeeds

#### Scenario: Numeric string weight from the form is accepted

- GIVEN a set whose weight arrives from the form as the string `"20"`
- WHEN it is validated
- THEN validation succeeds with the weight `20`

#### Scenario: Blank weight is rejected, not coerced to zero

- GIVEN a set whose weight is the empty string `""`
- WHEN it is validated
- THEN validation fails with a weight error
- AND the value is not accepted as `0`

#### Scenario: Null weight is rejected

- GIVEN a set whose weight is `null`
- WHEN it is validated
- THEN validation fails with a weight error
- AND the value is not accepted as `0`

#### Scenario: Missing weight is rejected

- GIVEN a set with no weight property
- WHEN it is validated
- THEN validation fails with a weight error

#### Scenario: Negative weight is rejected

- GIVEN a set with weight `-1`
- WHEN it is validated
- THEN validation fails with a weight error

#### Scenario: Non-finite weight is rejected

- GIVEN a set whose weight is `Infinity` or `NaN`
- WHEN it is validated
- THEN validation fails with a weight error

#### Scenario: Non-numeric weight is rejected

- GIVEN a set whose weight is the string `"abc"`
- WHEN it is validated
- THEN validation fails with a weight error

### Requirement: Repetitions must be a whole number of at least one

A set's repetitions MUST be accepted only when the value is an integer greater than or equal to `1`.
Zero, negative, fractional, blank, `null` and non-numeric values MUST be rejected.

#### Scenario: One repetition is accepted

- GIVEN a set with repetitions `1` and weight `0`
- WHEN it is validated
- THEN validation succeeds

#### Scenario: Numeric string repetitions from the form are accepted

- GIVEN a set whose repetitions arrive from the form as the string `"12"`
- WHEN it is validated
- THEN validation succeeds with repetitions `12`

#### Scenario: Zero repetitions are rejected

- GIVEN a set with repetitions `0`
- WHEN it is validated
- THEN validation fails with a repetitions error

#### Scenario: Negative repetitions are rejected

- GIVEN a set with repetitions `-3`
- WHEN it is validated
- THEN validation fails with a repetitions error

#### Scenario: Fractional repetitions are rejected

- GIVEN a set with repetitions `1.5`
- WHEN it is validated
- THEN validation fails with a repetitions error

#### Scenario: Blank repetitions are rejected

- GIVEN a set whose repetitions are the empty string `""`
- WHEN it is validated
- THEN validation fails with a repetitions error
- AND the value is not accepted as `0`

### Requirement: No upper bound on sets per exercise

An exercise MUST carry at least one set and MUST NOT be subject to any upper bound on the number of
sets. Submitting more than five sets for one exercise MUST validate and persist.

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

### Requirement: At least one exercise per workout

A workout MUST carry at least one exercise. A submission with an empty exercise list MUST be rejected by
validation before any database write.

#### Scenario: Zero exercises are rejected

- GIVEN a submission whose exercise list is empty
- WHEN the workout is validated
- THEN validation fails with an exercise-list error
- AND no workout is written

#### Scenario: One exercise with one set is accepted

- GIVEN a submission with one exercise carrying one valid set
- WHEN the workout is validated
- THEN validation succeeds

### Requirement: Warmup flag defaults to false

The set schema MUST accept an optional boolean warmup flag that defaults to `false` when absent, and MUST
reject a non-boolean value.

#### Scenario: Omitted warmup flag parses as false

- GIVEN a set with no warmup property
- WHEN it is validated
- THEN validation succeeds
- AND the parsed set carries the warmup flag `false`

#### Scenario: Explicit warmup flag is preserved

- GIVEN a set whose warmup flag is `true`
- WHEN it is validated
- THEN validation succeeds
- AND the parsed set carries the warmup flag `true`

#### Scenario: Non-boolean warmup flag is rejected

- GIVEN a set whose warmup flag is the string `"yes"`
- WHEN it is validated
- THEN validation fails with a warmup-flag error

### Requirement: Previously stored drafts remain loadable

Because the warmup flag defaults to `false`, a workout draft written under the existing
`gymbro:workout-draft:v1` storage key before this change MUST still parse and restore into the form. The
draft storage key MUST NOT be version-bumped, and no draft MAY be discarded solely because its sets lack
a warmup flag.

#### Scenario: Pre-change draft restores

- GIVEN a stored draft under `gymbro:workout-draft:v1` whose sets carry only repetitions and weight
- WHEN the creation page loads
- THEN the draft parses successfully and its exercises and sets are restored
- AND each restored set carries the warmup flag `false`

#### Scenario: Draft storage key is unchanged

- GIVEN this change is applied
- WHEN the draft storage key is inspected
- THEN it is still `gymbro:workout-draft:v1`

### Requirement: Weight guidance reflects the actual rule

Any message shown for an invalid weight MUST describe the rule that is actually enforced. It MUST NOT
instruct the user to add weight, because `0` is a valid weight.

#### Scenario: Weight message no longer demands a non-zero value

- GIVEN a weight field fails validation
- WHEN its message is shown
- THEN the message does not state that weight must be added or must be greater than zero
