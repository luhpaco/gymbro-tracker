# Authenticated Navigation Shell Specification

## Purpose

Define responsive, persistent authenticated navigation that prioritizes one-handed mobile workout use and desktop orientation without obscuring route content.

## Requirements

### Requirement: Responsive Destinations and Creation Actions

The system MUST expose Dashboard, Exercises, and Workouts on every authenticated viewport. On mobile, a fixed bottom dock MUST provide those destinations and a labeled Create control; Create MUST reveal a chooser for the existing exercise and workout creation routes. On desktop, a persistent rail MUST provide the destinations and separate Create actions; a hamburger overlay MUST NOT be required.

#### Scenario: Mobile destination and creation access

- GIVEN an authenticated user views a non-workout-creation route on a mobile viewport
- WHEN they select a dock destination or open Create
- THEN the selected destination or existing creation route MUST be reachable
- AND Create MUST present both creation choices without navigating first

#### Scenario: Desktop rail replaces overlay navigation

- GIVEN an authenticated user views any route on a desktop viewport
- WHEN the navigation shell renders
- THEN a persistent rail MUST expose destinations and separate Create actions
- AND no hamburger overlay interaction MUST be necessary

### Requirement: Accessible Navigation and Create Chooser

The system MUST identify the active destination and provide keyboard- and assistive-technology-accessible navigation. The mobile Create chooser MUST have an accessible name, move focus into the chooser when opened, return focus to its trigger when closed, and close with Escape.

#### Scenario: Keyboard chooser lifecycle

- GIVEN a keyboard user focuses the mobile Create control
- WHEN they open the chooser and press Escape
- THEN focus MUST enter the chooser and return to Create after it closes

#### Scenario: Active destination is announced

- GIVEN an authenticated route matches a navigation destination
- WHEN a user inspects the navigation with assistive technology
- THEN the matching destination MUST be conveyed as current

### Requirement: Content Clearance and Workout-Creation Priority

The authenticated shell MUST reserve clearance for its visible dock or rail so route content and route-level controls remain reachable. On `/workouts/create`, the mobile dock MUST reduce or hide only while unsaved exercises or sets exist; it MUST remain available when that unsaved content is absent. Desktop rail availability MUST remain unchanged.

#### Scenario: Shell chrome does not obscure content

- GIVEN an authenticated route has scrollable content or a route-level control
- WHEN it renders with the applicable dock or rail
- THEN content and controls MUST remain reachable without being obscured

#### Scenario: Unsaved workout creation suppresses only mobile dock

- GIVEN an authenticated user is on `/workouts/create` with an unsaved exercise or set
- WHEN the workout-creation state updates
- THEN the mobile dock MUST reduce or hide
- AND the desktop rail MUST remain available

#### Scenario: Empty workout creation retains mobile navigation

- GIVEN an authenticated user is on `/workouts/create` without unsaved exercises or sets
- WHEN the page renders on mobile
- THEN the mobile dock MUST remain available
