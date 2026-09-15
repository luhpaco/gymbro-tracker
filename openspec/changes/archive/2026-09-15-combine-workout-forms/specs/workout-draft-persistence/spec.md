# Workout Draft Persistence Specification

## Purpose

The in-progress, unsaved workout creation draft (name, date, exercises, sets) survives a page refresh or navigation away, and is cleared once the workout is successfully saved, so partially entered work is not silently lost.

## Requirements

### Requirement: Draft survives refresh and navigation

While a workout creation form has at least one non-empty field (name, date, or an exercise), its current values MUST be persisted to `localStorage` such that reloading or re-entering `/workouts/create` restores them.

#### Scenario: Draft restored after refresh

- GIVEN the user has entered a workout name and added one exercise with sets, without submitting
- WHEN the user refreshes the page
- THEN the name and the previously added exercise (with its sets) are restored into the form

#### Scenario: Draft restored after navigating away and back

- GIVEN the user has partially filled the form and navigates to a different page without submitting
- WHEN the user returns to `/workouts/create`
- THEN the previously entered values are restored

#### Scenario: Empty form persists nothing meaningful

- GIVEN the user opens `/workouts/create` and has not entered anything
- WHEN the page is left and revisited
- THEN no stale, unrelated, or default-looking draft data appears to have been "restored"

### Requirement: Draft cleared on successful save

Once `createWorkout` succeeds for the current draft, the persisted draft MUST be removed, so revisiting the creation page afterward starts from an empty form.

#### Scenario: Draft cleared after successful creation

- GIVEN a user has a persisted draft and submits it successfully
- WHEN `createWorkout` resolves successfully
- THEN the persisted draft is removed from `localStorage`
- AND revisiting `/workouts/create` afterward shows an empty form

### Requirement: Corrupt or invalid draft is discarded, not fatal

If the persisted draft cannot be parsed or fails schema validation on load (e.g., from a stale shape after a future change), the form MUST start empty instead of throwing or rendering a broken state.

#### Scenario: Malformed stored draft is ignored safely

- GIVEN `localStorage` holds a value for the draft key that is not valid JSON or does not match the expected shape
- WHEN `/workouts/create` loads
- THEN the form renders with empty defaults
- AND no unhandled exception is thrown
