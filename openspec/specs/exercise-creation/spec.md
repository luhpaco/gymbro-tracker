# Exercise Creation Specification

## Purpose

Exercise creation entry points on the exercises page, and muscle-group pre-scoping of the create-exercise form via a validated `muscleGroup` query parameter.

## Requirements

### Requirement: Always-Visible Exercise Creation CTA

The `/exercises` page SHALL render a "Crear ejercicio" call-to-action that is visible regardless of whether the exercise list is empty or populated, and that navigates to `/exercises/create`.

When a muscle-group filter other than "all" is active, the CTA link SHALL target `/exercises/create?muscleGroup=<tag>`; when no filter is active, it SHALL target `/exercises/create` with no query parameter.

#### Scenario: CTA visible with a populated list

- GIVEN the user is on `/exercises` with at least one exercise rendered
- WHEN the page is displayed
- THEN a "Crear ejercicio" CTA is visible and links to `/exercises/create`

#### Scenario: CTA visible with an empty unfiltered list

- GIVEN the user is on `/exercises` with no exercises and no active filter
- WHEN the page is displayed
- THEN a "Crear ejercicio" CTA is visible alongside the empty state

#### Scenario: CTA carries the active filter

- GIVEN the user is on `/exercises` with a muscle-group filter other than "all" active
- WHEN the CTA is rendered
- THEN its link targets `/exercises/create?muscleGroup=<tag>` for the active muscle group

### Requirement: Filter-Driven Param Derivation

Entry points on `/exercises` SHALL derive the `muscleGroup` param from the filter that produced the visible exercise list (the last submitted filter), and MUST NOT derive it from an unsubmitted draft selection in the filter form.

#### Scenario: Empty-state link reflects the active filter

- GIVEN a muscle-group filter other than "all" produced an empty exercise list
- WHEN the empty-state creation link is rendered
- THEN it targets `/exercises/create?muscleGroup=<tag>` for that filter

#### Scenario: Empty-state link without a filter

- GIVEN an empty exercise list with no filter or with the "all" filter
- WHEN the empty-state creation link is rendered
- THEN it targets `/exercises/create` without a `muscleGroup` param

#### Scenario: Draft selection differs from the submitted filter

- GIVEN the user changed the filter select without submitting it
- WHEN the creation CTA link is rendered
- THEN its param (or its absence) reflects the last submitted filter, not the draft selection

### Requirement: Muscle-Group Pre-scoping of the Create Form

The `/exercises/create` page SHALL read the `muscleGroup` query parameter and, if and only if the tag matches a known muscle group, pre-scope the create-exercise form to that muscle group. For an absent, empty, or unknown tag, the page MUST behave exactly as if no parameter had been sent.

#### Scenario: Valid tag pre-scopes the form

- GIVEN the user navigates to `/exercises/create?muscleGroup=<tag>` where the tag is a known muscle group
- WHEN the create form is rendered
- THEN the muscle-group field is pre-selected to that muscle group

#### Scenario: Unknown tag is ignored

- GIVEN the user navigates to `/exercises/create?muscleGroup=<tag>` where the tag is not a known muscle group
- WHEN the create form is rendered
- THEN the form is un-scoped, identical to navigation without the parameter
- AND the unknown value MUST NOT be submittable as the exercise's muscle group

#### Scenario: No parameter leaves the form un-scoped

- GIVEN the user navigates to `/exercises/create` with no `muscleGroup` parameter
- WHEN the create form is rendered
- THEN the muscle-group field has no pre-selection
