# platform-runtime-baseline Specification

## Purpose

Defines the framework/runtime version contract and behavioral invariants (auth gating, dynamic-route params) that MUST hold across a Next.js major-version upgrade. Versioned incrementally: `nextjs-15-upgrade` establishes the Next 15 / React 19 baseline; the future `nextjs-16-upgrade` updates this same spec, not a new capability.

## Requirements

### Requirement: Framework and Runtime Version Contract

The system MUST run on `next` 15.x, `react`/`react-dom` 19.x, and matching `@types/react`/`@types/react-dom` for React 19. The system MUST pin `next-auth` to exactly `5.0.0-beta.32` (not a dist-tag or range). The system MUST use `eslint-config-next` matched to the installed `next` 15.x line.

#### Scenario: Lockfile resolves pinned versions

- GIVEN `pnpm-lock.yaml` after dependency installation
- WHEN the resolved version of `next-auth` is inspected
- THEN it MUST equal exactly `5.0.0-beta.32`
- AND `next` MUST resolve to a 15.x version

#### Scenario: Type-check and lint pass under the new baseline

- GIVEN the upgraded dependency set is installed
- WHEN `pnpm exec tsc --noEmit` and `pnpm lint` are run
- THEN both MUST complete with zero errors

### Requirement: Auth-Gate Invariant

Middleware-based authentication (`src/middleware.ts`, `src/auth.config.ts`) MUST continue to gate protected routes and redirect correctly, unchanged in behavior from the pre-upgrade baseline, regardless of the underlying Next.js/React/next-auth version.

#### Scenario: Logged-out access redirects to login with origin

- GIVEN a user with no active session
- WHEN they request `/dashboard`, `/exercises`, or `/workouts`
- THEN the system MUST redirect to `/auth/login?origin=<requested-path>`

#### Scenario: Logged-in access redirects away from login

- GIVEN a user with an active session
- WHEN they request `/auth/login`
- THEN the system MUST redirect them to `/dashboard`

### Requirement: Dynamic Route Params Invariant

Dynamic route segments MUST render correctly under the async Request API (`params` as a `Promise`), producing the same page content and behavior as before the upgrade.

#### Scenario: Workout slug page renders with awaited params

- GIVEN a valid workout slug
- WHEN `/workouts/[slug]` is requested
- THEN the page MUST await `params` before use and render the correct workout

#### Scenario: Exercise update page renders with awaited params

- GIVEN a valid exercise id
- WHEN `/exercises/update/[id]` is requested
- THEN the page MUST await `params` before use and render the correct exercise form

### Requirement: Calendar Component Functional Parity

The workout date picker MUST provide functional parity with its pre-upgrade behavior after migrating to the `react-day-picker` major supported by the upgraded shadcn/ui calendar component. Pixel-identical rendering is NOT required.

#### Scenario: Date picker opens, selects a date, and closes

- GIVEN the `SummaryWorkoutForm` calendar popover is closed
- WHEN the user opens it, selects a date, and confirms
- THEN the popover MUST close and the selected date MUST bind to the form's `selected` value

### Requirement: Manual Verification Checklist (No Automated Test Runner)

Because no test runner is configured for this project, the scenarios in this spec MUST be manually verified against a running instance before the change is archived, and the user MUST explicitly sign off on this checklist during `sdd-verify`. Automated static gates (`tsc --noEmit`, `pnpm lint`, `pnpm build`) MUST also pass but do NOT substitute for the manual auth and UI checks.

#### Scenario: Manual sign-off blocks archive

- GIVEN `pnpm build` has succeeded
- WHEN `sdd-verify` runs
- THEN the auth-gate, dynamic-route, and calendar scenarios above MUST each be manually exercised and confirmed
- AND the change MUST NOT proceed to `sdd-archive` without explicit user sign-off on this checklist

### Requirement: Upgrade Scope Boundary (Non-Goals)

This capability version MUST NOT include Turbopack-by-default handling, the `middleware.ts`→`proxy.ts` rename, ESLint flat-config migration, or a Node.js version pin. These are explicitly deferred to the future `nextjs-16-upgrade` change, which updates this same spec.

#### Scenario: Out-of-scope work is absent from this change

- GIVEN the `nextjs-15-upgrade` change is complete
- WHEN the diff is reviewed against this spec
- THEN it MUST contain no Turbopack config changes, no `proxy.ts` rename, no ESLint flat-config migration, and no Node engine pin
