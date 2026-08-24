# Automated Code Review Specification

## Purpose

Repo-scoped configuration (`.coderabbit.yaml`) for the already-installed CodeRabbit GitHub App, so its automated PR review reflects this project's conventions instead of generic advice.

## Non-Goals

- Installing or configuring the CodeRabbit GitHub App itself (already installed, confirmed by user).
- Any CI-driven or token-based invocation — CodeRabbit is webhook-driven and needs no workflow step.

## Requirements

### Requirement: Review Profile

`.coderabbit.yaml` MUST set `reviews.profile: chill`, favoring substantive-issue feedback over nitpicks, appropriate for a repo where most code is agent-generated.

#### Scenario: Review posted on a PR

- GIVEN a new PR is opened
- WHEN CodeRabbit reviews it
- THEN it applies the `chill` profile and does not flag minor style nitpicks already covered by lint/format

### Requirement: Auto Review Enabled

`.coderabbit.yaml` MUST set `reviews.auto_review.enabled: true` so CodeRabbit reviews automatically without manual invocation.

#### Scenario: PR opened without manual trigger

- GIVEN a PR is opened against `master`
- WHEN no `@coderabbitai review` comment is posted
- THEN CodeRabbit still reviews the PR automatically

### Requirement: Path Instructions Encode Repo Conventions

`reviews.path_instructions` MUST encode CLAUDE.md's conventions: Zod validation is required on `src/actions/**` server actions; Prisma queries are confined to `src/lib/`/`src/data/` and MUST NOT appear in components; file naming is kebab-case; imports use the `@/` alias for `src/`.

#### Scenario: PR adds a server action without Zod validation

- GIVEN a PR adds a file under `src/actions/**` that reads input without a Zod schema
- WHEN CodeRabbit reviews it
- THEN it flags the missing Zod validation per the configured path instruction

#### Scenario: PR adds a Prisma query inside a component

- GIVEN a PR adds a direct Prisma query inside a file under `src/components/**`
- WHEN CodeRabbit reviews it
- THEN it flags the query as violating the data-layer convention

### Requirement: Path Filters Exclude Non-Review Paths

`reviews.path_filters` MUST exclude `design/**` (gitignored scratch space) and `openspec/changes/archive/**` (closed/historical changes) from review.

#### Scenario: PR touches design/ scratch files

- GIVEN a PR includes changes under `design/**`
- WHEN CodeRabbit reviews the PR
- THEN it does not comment on those files

#### Scenario: PR touches archived SDD changes

- GIVEN a PR includes changes under `openspec/changes/archive/**`
- WHEN CodeRabbit reviews the PR
- THEN it does not comment on those files

### Requirement: No Suggestions on Migration Files

`.coderabbit.yaml` MUST instruct CodeRabbit not to suggest edits to files under `prisma/migrations/**`, consistent with the repo's hard rule that migrations are rolled forward, never hand-edited.

#### Scenario: PR includes a generated migration file

- GIVEN a PR includes a new file under `prisma/migrations/**`
- WHEN CodeRabbit reviews it
- THEN it does not suggest editing that migration file, even if it would otherwise flag a style issue
