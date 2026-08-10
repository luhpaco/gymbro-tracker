# Proposal: Vercel Prisma Deploy Fix

## Intent

Prevent Vercel deployments from failing when a cached or missing Prisma Client is used during Next.js build collection. Make Prisma Client generation part of every repository-defined build and keep the CLI and client versions aligned for preview and production deployments.

## Scope

### In Scope
- Run `prisma generate` before every `next build` through the package build script.
- Pin `prisma` and `@prisma/client` to exact version `5.18.0`.
- Refresh and review the pnpm lockfile, then validate preview and production redeploys on Vercel.

### Out of Scope
- Node.js 24 adoption.
- Route, authentication, or Prisma schema changes.
- Repository-managed Vercel configuration or unrelated dependency upgrades.

## Capabilities

### New Capabilities
None. This change hardens deployment configuration without introducing product behavior.

### Modified Capabilities
None. No existing product requirement changes.

## Approach

Set `build` to `prisma generate && next build`, pin both Prisma packages to `5.18.0`, and regenerate `pnpm-lock.yaml`. This makes client generation explicit in the default build contract used by preview and production deployments while avoiding application-code and platform-config changes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add generation to `build`; align exact Prisma versions. |
| `pnpm-lock.yaml` | Modified | Record aligned client, CLI, and engine resolutions. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A manual Vercel Build Command bypasses `pnpm build`. | Medium | Confirm both deployment environments use the repository build script before acceptance. |
| Lockfile refresh changes Prisma engine entries unexpectedly. | Low | Review the lockfile diff and reject unrelated upgrades. |

## Rollback Plan

Revert `package.json` and `pnpm-lock.yaml` together to restore the prior build command and dependency resolutions, then redeploy the last known-good commit.

## Dependencies

- Vercel preview and production projects must invoke `pnpm build`.
- Deployment access is required for external acceptance verification.

## Success Criteria

- [ ] `pnpm build` generates Prisma Client before Next.js starts.
- [ ] Both Prisma packages resolve to exact version `5.18.0`.
- [ ] Preview and production redeploys complete successfully on Vercel.
