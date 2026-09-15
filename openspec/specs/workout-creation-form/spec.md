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

The form MUST validate name, date, and every exercise/set together and submit exactly once to `createWorkout`. No field required by validation MAY be populated by a side effect outside the form's own submit handler.

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

#### Scenario: Server contract is unchanged

- GIVEN a successfully validated form submission
- WHEN `createWorkout` receives the payload
- THEN the payload shape matches `CreateWorkoutFormData` as consumed by `createWorkout` today (name, date, tag, and a list of exercises each with an exercise id/name and sets)

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
