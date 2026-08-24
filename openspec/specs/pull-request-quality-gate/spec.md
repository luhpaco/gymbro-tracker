# Pull Request Quality Gate Specification

## Purpose

Automated, deterministic verification of every pull request into `master`, replacing reliance on an agent remembering to run `pnpm lint`/`pnpm build` manually. Runs as a single GitHub Actions job.

## Non-Goals

- Branch protection making this check merge-blocking (deferred; requires separate user go-ahead on GitHub repo settings).
- Stage 2 mock-based server-action/component tests, Stage 3 Postgres-integration tests.
- Dependabot or any dependency-update automation.

## Requirements

### Requirement: CI Trigger Scope

The workflow MUST trigger only on `pull_request` events targeting the `master` branch. The workflow MUST NOT trigger on `push` to `master` or any other branch/event.

#### Scenario: PR opened against master

- GIVEN a pull request is opened targeting `master`
- WHEN the PR is created or updated with new commits
- THEN the CI workflow runs

#### Scenario: Direct push to master

- GIVEN a commit is pushed directly to `master` (no PR)
- WHEN the push event fires
- THEN the CI workflow does NOT run

### Requirement: Toolchain Pinning

The workflow MUST derive the Node.js and pnpm versions from `package.json`'s `engines`/`packageManager` fields rather than floating "latest" versions.

#### Scenario: Setup step reads package.json

- GIVEN the CI job starts
- WHEN the node/pnpm setup step executes
- THEN the pinned versions match `package.json`'s `engines`/`packageManager`

### Requirement: Sequential Verification Steps

The workflow MUST run, in order, after checkout and toolchain setup: `pnpm install --frozen-lockfile` → set placeholder env vars → `pnpm lint` → `pnpm exec prettier --check .` → `pnpm exec tsc --noEmit` → `pnpm test` → `pnpm exec prisma validate` → `pnpm build`.

#### Scenario: All steps pass

- GIVEN a PR with lint-clean, formatted, type-safe, tested, schema-valid, buildable code
- WHEN the workflow runs
- THEN every step succeeds and the overall check reports success

#### Scenario: A step fails

- GIVEN a PR that fails any single step (e.g. lint, format check, typecheck, test, `prisma validate`, or build)
- WHEN the workflow runs
- THEN that step fails and the overall CI check reports failure, visible on the PR

### Requirement: Placeholder Environment Variables

The workflow MUST provide CI-only placeholder values for `POSTGRES_URL` and `AUTH_SECRET` sufficient for `pnpm build` to complete. The workflow MUST NOT reference real secrets or production credentials.

#### Scenario: Build step requires env vars

- GIVEN the build step needs `POSTGRES_URL`/`AUTH_SECRET` at compile time
- WHEN the workflow runs
- THEN placeholder values are injected and no real secret is read or exposed

### Requirement: Advisory-Only Enforcement

This change MUST configure only the CI check itself. Branch protection rules that make this check a merge-blocker on `master` MUST NOT be configured as part of this change; the check remains advisory (visible, non-blocking) until a human explicitly enables branch protection separately.

#### Scenario: Failing PR remains mergeable

- GIVEN a PR whose CI check has failed
- WHEN a repo admin attempts to merge it
- THEN GitHub does not block the merge (no branch protection rule exists yet)

### Requirement: Stage 1 Test Scope

`pnpm test` MUST run Vitest against pure-logic targets only: `src/store/**/*-store.ts`, `src/lib/schemas/workout-set.ts`, and `src/lib/utils.ts`. This requirement MUST NOT include component or DOM-rendering tests.

#### Scenario: Test run covers Stage 1 targets

- GIVEN the Stage 1 Vitest suite
- WHEN `pnpm test` runs in CI
- THEN it exercises the Zustand stores, the `workout-set` Zod schema, and `utils.ts`, and no component/DOM test runs
