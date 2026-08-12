# Supabase PostgreSQL Deployment Specification

## Purpose

Define acceptance for the database, migration checkpoint, Preview smoke evidence, and PR #1 boundary.

## Requirements

### Requirement: Shared Database Safety

Preview and Production MUST share one Supabase Free database. Preview MUST use only disposable data and MUST NOT seed or alter non-disposable data.

#### Scenario: Preview uses disposable data

- GIVEN Preview and Production target the shared database
- WHEN Preview creates an account, exercise, or workout
- THEN every created record is disposable
- AND no seed operation or non-disposable data mutation occurs

### Requirement: Secret Custody and Non-Disclosure

`POSTGRES_URL` and one stable `AUTH_SECRET` MUST exist only as Vercel-managed Preview and Production secrets. Runtime `POSTGRES_URL` MUST use transaction pooling. Secret values and the session-mode migration URL MUST NOT be disclosed or persisted.

#### Scenario: Scoped runtime secrets are available

- GIVEN Vercel holds the two secrets for Preview and Production
- WHEN either environment starts the application
- THEN it receives the scoped values without repository storage
- AND both environments receive the same stable `AUTH_SECRET`

#### Scenario: Disclosure evidence is detected

- GIVEN artifacts and repository changes are inspected
- WHEN any database URL or secret value appears outside Vercel custody or the user's private session
- THEN acceptance MUST fail without reproducing the exposed value

### Requirement: Migration Checkpoint

Before smoke acceptance, the user alone MUST run one `prisma migrate deploy` with an undisclosed, non-persisted session-mode connection. It MUST apply only committed migrations and MUST NOT run in build or deployment automation.

#### Scenario: Migration succeeds

- GIVEN secrets are configured and committed migrations are unchanged
- WHEN the user runs the migration command in a private session
- THEN a successful command result satisfies the migration checkpoint
- AND smoke acceptance MAY begin without retaining the connection URL

#### Scenario: Migration fails

- GIVEN the migration checkpoint is in progress
- WHEN `prisma migrate deploy` returns failure
- THEN acceptance and smoke execution MUST halt
- AND automation MUST NOT retry, rewrite migrations, roll back, or disclose the URL

### Requirement: Vercel Node.js 24 Configuration

Vercel MUST use Node.js `24.x`; `package.json` MUST declare `engines.node` as `24.x`. Both MUST agree before acceptance.

#### Scenario: Node configuration is verified

- GIVEN the deployment configuration and repository are inspectable
- WHEN Node.js settings are assessed
- THEN Vercel and `package.json` both report `24.x`
- AND any missing or conflicting setting blocks acceptance

### Requirement: Immutable Change Boundaries

The change MUST NOT modify Prisma schema, migrations, seed behavior, build migration behavior, or `.gitignore`.

#### Scenario: Scope audit remains clean

- GIVEN the change diff is available
- WHEN protected paths and build behavior are checked
- THEN no prohibited modification is present
- AND only approved deployment configuration changes remain

### Requirement: Fresh-Session Preview Smoke Sequence

After migration succeeds, Preview MUST pass registration, login, dashboard, exercises, workouts, and logout in order from a fresh session using disposable data.

#### Scenario: Complete smoke sequence passes

- GIVEN a fresh browser session with no authenticated state
- WHEN the ordered smoke sequence is executed on Preview
- THEN every step completes successfully through logout
- AND exercise and workout data created by the sequence is disposable

#### Scenario: A smoke step fails

- GIVEN the ordered Preview smoke sequence is running
- WHEN any required step fails or is skipped
- THEN Preview acceptance MUST fail
- AND later successful steps MUST NOT substitute for the missing evidence

### Requirement: Read-Only PR #1 Readiness Assessment

PR #1 MUST receive a readiness assessment from its status, checks, and diff. It MUST report readiness and blockers without merging or mutating the PR. Production launch remains out of scope.

#### Scenario: Readiness is reported without mutation

- GIVEN PR #1 metadata and diff are readable
- WHEN readiness is assessed
- THEN the result identifies readiness and blockers
- AND PR #1 remains unmerged and unchanged
