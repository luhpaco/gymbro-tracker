# Build and Deployment Reliability Specification

## Purpose

Define the repository build and Vercel deployment contract that prevents missing or stale Prisma Client artifacts. This operational specification introduces no product capability and excludes Node.js 24, application routes, authentication, and Prisma schema behavior.

## Requirements

### Requirement: Prisma Client Generation Precedes Next.js Build

The standard repository build script MUST generate Prisma Client before starting the Next.js production build, and MUST NOT start Next.js when generation fails.

#### Scenario: Standard build generates Prisma Client first

- GIVEN dependencies are installed from the repository lockfile
- WHEN `pnpm build` is executed
- THEN Prisma Client generation MUST complete before `next build` starts

#### Scenario: Generation failure stops the build

- GIVEN Prisma Client generation returns a non-zero exit status
- WHEN `pnpm build` is executed
- THEN `next build` MUST NOT start
- AND the build MUST return a non-zero exit status

### Requirement: Prisma Package Versions Are Exact and Aligned

The repository manifest and lockfile MUST resolve both `prisma` and `@prisma/client` to exact version `5.18.0`, without ranges or divergent resolved versions.

#### Scenario: Manifest and lockfile are aligned

- GIVEN the committed manifest and lockfile
- WHEN Prisma dependency versions are inspected
- THEN both packages MUST declare and resolve to `5.18.0`

#### Scenario: Drift fails validation

- GIVEN either Prisma package uses a range or resolves to another version
- WHEN dependency alignment is validated
- THEN validation MUST fail and identify the noncompliant package

### Requirement: Vercel Deployments Use the Standard Build Script

Preview and production Vercel deployments MUST invoke `pnpm build` as the build entry point and MUST complete successfully using the committed manifest and lockfile.

#### Scenario: Preview and production deploy successfully

- GIVEN a commit containing the aligned Prisma dependencies and standard build script
- WHEN that commit is deployed to preview and production
- THEN both deployments MUST invoke `pnpm build`
- AND both deployments MUST complete successfully

#### Scenario: Build-command bypass blocks acceptance

- GIVEN either Vercel environment bypasses `pnpm build`
- WHEN deployment acceptance is evaluated
- THEN the change MUST NOT be accepted
- AND the bypassing environment MUST be identified
