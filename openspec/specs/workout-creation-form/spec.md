# Workout Creation Form Specification

## Purpose

A single, continuous, modal-free form for creating a workout — name, date, and a dynamic list of exercises with their sets — validated and submitted as one unit, replacing the prior split between a per-exercise dialog and a disconnected final name/date form.

## Requirements

### Requirement: Single-page authoring surface

The workout creation page MUST present name, date, and the exercise/set list in one continuously visible form. No exercise MAY be added through a modal dialog that must be individually opened and submitted per exercise.

#### Scenario: Exercises are added inline

- GIVEN the user is on `/workouts/create`
- WHEN the user adds a new exercise
- THEN the exercise row (picker + set fields) appears inline on the page
- AND no dialog/modal is opened to add it

#### Scenario: Name and date are always visible

- GIVEN the user is on `/workouts/create` with zero or more exercises already added
- WHEN the page is rendered
- THEN the `nameWorkout` and `dateWorkout` fields are visible without requiring any exercise to be added first

### Requirement: Single validated submission

The form MUST validate name, date, and every exercise/set together and submit exactly once to
`createWorkout`. No field required by validation MAY be populated by a side effect outside the form's own
submit handler. The submitted payload MUST carry a warmup flag per set, defaulting to `false`, and MUST
NOT be subject to an upper bound on the number of sets per exercise.
(Previously: The payload shape was required to match `CreateWorkoutFormData` exactly as consumed by
`createWorkout` before this change — no per-set warmup flag, and a five-set-per-exercise cap.)

#### Scenario: One submit creates the workout

- GIVEN a user has filled name, date, and at least one exercise with at least one set
- WHEN the user submits the form
- THEN `createWorkout` is called exactly once with the full validated payload
- AND no additional dialog submission is required beforehand

#### Scenario: Validation blocks an incomplete submission

- GIVEN the user has not added any exercise
- WHEN the user attempts to submit
- THEN the submission is blocked by the form's own validation
- AND a validation error is shown for the missing exercise list, not a silent no-op

#### Scenario: Server contract carries the warmup flag

- GIVEN a successfully validated form submission
- WHEN `createWorkout` receives the payload
- THEN the payload shape matches `CreateWorkoutFormData` — name, date, tag, and a list of exercises each
  with an exercise id/name and sets — with every set additionally carrying a boolean warmup flag
- AND each set created by the form carries that flag as `false` by default

#### Scenario: Set order is not supplied by the form

- GIVEN a successfully validated form submission
- WHEN `createWorkout` receives the payload
- THEN the payload carries no set order value
- AND the server derives each set's order from its position in the submitted payload

### Requirement: Inline exercise and set management

The user MUST be able to add, remove, and edit exercises and their sets (reps/weight) inline on the page, including editing a value after it was first entered, without any of these actions triggering a separate form submission.

#### Scenario: Editing an already-added set

- GIVEN an exercise with at least one set has already been added to the form
- WHEN the user edits that set's reps or weight
- THEN the change is reflected in the same form state that will be submitted
- AND no separate store or submission outside the form is used to persist the edit

#### Scenario: Removing an exercise

- GIVEN two or more exercises have been added
- WHEN the user removes one exercise
- THEN that exercise and its sets are removed from the form state
- AND the remaining exercises and their sets are unaffected
### Requirement: No set cap in the authoring surface

The creation form MUST allow adding an unbounded number of sets to any exercise. The control that adds a
set MUST NOT be disabled once an exercise reaches five sets, and no message MAY tell the user to stop
adding sets.

#### Scenario: A sixth set can be added

- GIVEN an exercise in the form already has five sets
- WHEN the user views the add-set control for that exercise
- THEN the control is enabled
- AND activating it adds a sixth set

#### Scenario: A many-set exercise submits successfully

- GIVEN an exercise in the form has ten sets, all with valid values
- WHEN the user submits
- THEN validation passes
- AND `createWorkout` receives all ten sets

### Requirement: Bodyweight sets are accepted by the form

The form MUST accept a weight of `0` on any set so bodyweight exercises can be recorded. It MUST still
block submission when a weight field is left blank, and the message shown for an invalid weight MUST NOT
tell the user that weight must be added or must be greater than zero.

#### Scenario: Zero weight submits

- GIVEN the user enters weight `0` and repetitions `10` on a set
- WHEN the user submits
- THEN validation passes for that set

#### Scenario: Blank weight blocks submission

- GIVEN the user leaves a weight field empty
- WHEN the user submits
- THEN validation fails for that field
- AND the empty value is not submitted as `0`

#### Scenario: Weight message is not stale

- GIVEN a weight field shows a validation message
- WHEN the message is read
- THEN it does not state that weight must be added or must be greater than zero

### Requirement: The form handles every creation failure code

The form MUST show a code-specific destructive message for every failure code `createWorkout` can
return, including the tag-exhaustion code, and MUST keep the form editable afterwards. It MUST NOT fall
back to the generic retry advice for the tag-exhaustion code, since retrying identically cannot succeed.

#### Scenario: Tag exhaustion shows an honest message

- GIVEN `createWorkout` returns `{ ok: false, code: "duplicate_tag" }`
- WHEN the form handles the result
- THEN it shows a message specific to that code
- AND that message is not the generic "try again" message used for `error`
- AND the form remains editable with the user's entered values intact

#### Scenario: Other failure codes keep their existing behavior

- GIVEN `createWorkout` returns `unauthorized`, `invalid_input` or `error`
- WHEN the form handles the result
- THEN it shows that code's existing destructive message
- AND the form remains editable

#### Scenario: Success keeps its existing flow

- GIVEN `createWorkout` returns a successful result
- WHEN the form handles it
- THEN it performs its existing success flow, including clearing the persisted draft
