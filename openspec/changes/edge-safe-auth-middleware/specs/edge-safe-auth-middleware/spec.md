# Edge-Safe Auth Middleware Specification

## Purpose

Define runtime-safe Auth.js composition that preserves current authentication semantics while preventing Node-only dependencies from entering the middleware Edge bundle. Node 24, Vercel configuration, Prisma schema or migrations, and authentication product changes are outside this capability.

## Requirements

### Requirement: Edge-safe middleware boundary

The middleware Auth.js configuration MUST remain free of direct and transitive Node-only imports, including Credentials authorization, Prisma, and bcrypt. Middleware route protection MUST depend only on Edge-compatible configuration.

#### Scenario: Middleware builds for Preview

- GIVEN the middleware import graph contains only Edge-compatible dependencies
- WHEN a Preview deployment bundles the middleware
- THEN the middleware bundle MUST complete without Node-only dependency errors

#### Scenario: Node-only dependency reaches middleware

- GIVEN Credentials, Prisma, or bcrypt is reachable from the middleware import graph
- WHEN the runtime boundary is evaluated
- THEN the change MUST fail acceptance

### Requirement: Node-only authentication instance

A Node-only Auth.js instance MUST own Credentials authorization, Prisma user lookup, bcrypt password verification, and the exported handlers and authentication helpers used by API handlers, server actions, and server-rendered pages. Successful authorization MUST continue to exclude the password from user data.

#### Scenario: Valid credentials

- GIVEN a registered user supplies valid credentials
- WHEN the Node-only instance authorizes the login
- THEN authentication MUST succeed without exposing the password in user or session data

#### Scenario: Invalid credentials

- GIVEN credentials are invalid or fail validation
- WHEN the Node-only instance authorizes the login
- THEN authentication MUST retain the current invalid-credentials outcome

### Requirement: Authentication behavior preservation

The split MUST preserve the existing `authorized`, JWT, and session callbacks; JWT and session user shape; custom pages; redirect destinations and origin handling; middleware matcher; and `trustHost` behavior. Existing sessions MAY become invalid after deployment, but no authorization policy or UX behavior MAY otherwise change.

#### Scenario: Protected route without a session

- GIVEN an unauthenticated request matches a protected dashboard, exercises, or workouts route
- WHEN middleware authorizes the request
- THEN it MUST redirect to the existing sign-in page with the current origin semantics

#### Scenario: Authenticated user visits an auth page

- GIVEN an authenticated user requests an existing login or registration route
- WHEN middleware authorizes the request
- THEN it MUST redirect the user to the dashboard

#### Scenario: JWT becomes a session

- GIVEN a fresh successful login produces the current JWT user payload
- WHEN Auth.js creates the session
- THEN the session user MUST retain the existing shape and values

#### Scenario: Existing session is invalidated

- GIVEN a pre-deployment session is no longer accepted after deployment
- WHEN the user authenticates again with valid credentials
- THEN a fresh session MUST restore the preserved authenticated behavior

### Requirement: Preview acceptance

The change MUST be accepted only after a successful Preview deployment and fresh-session smoke tests for login, logout, dashboard, exercises, and workouts. Local lint, type-check, or build results MUST NOT replace Preview evidence.

#### Scenario: Authenticated smoke path

- GIVEN a deployed Preview with database access and valid credentials
- WHEN login, dashboard, exercises, and workouts are exercised with a fresh session
- THEN every path MUST complete with the existing authenticated behavior

#### Scenario: Logout smoke path

- GIVEN an authenticated fresh Preview session
- WHEN the user logs out
- THEN the session MUST end and redirect to the existing sign-in destination

#### Scenario: Preview deployment fails

- GIVEN any Edge bundling failure or required smoke-test failure
- WHEN acceptance is evaluated
- THEN the change MUST NOT be accepted
