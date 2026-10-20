# Launch Minimums Specification

## Purpose

Define the minimum production-readiness behavior of the application root: where `/` sends visitors, that no public data-mutating seed endpoint exists, and the document language.

## Requirements

### Requirement: Root Route Redirect

The system MUST redirect requests for `/` according to session state, decided in a single place (the `authorized` callback). A request with an active session MUST be redirected to `/dashboard`. A request without a session MUST be redirected to `/auth/login` without an `origin` parameter. The system MUST NOT define a competing static redirect for `/` that bypasses the session check.

#### Scenario: Visitor without a session

- GIVEN a visitor without an active session
- WHEN they request `/`
- THEN they MUST be redirected directly to `/auth/login`

#### Scenario: Visitor with a session

- GIVEN a user with an active session
- WHEN they request `/`
- THEN they MUST be redirected to `/dashboard`

### Requirement: No Public Seed Endpoint

The system MUST NOT expose an unauthenticated HTTP endpoint that inserts reference data. Reference data MUST be provisioned only through versioned migrations.

#### Scenario: Seed endpoint is gone

- GIVEN the application is running
- WHEN a client requests `GET /api/seed`
- THEN the response MUST be 404

### Requirement: Document Language

The root document MUST declare `lang="es"` to match the application's Spanish copy.

#### Scenario: Root document language

- GIVEN any rendered page
- WHEN the document is inspected
- THEN `document.documentElement.lang` MUST equal `es`
