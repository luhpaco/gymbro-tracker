# Proposal: Edge-Safe Auth Middleware

## Intent

Prevent Preview deployment failures caused by middleware bundling Node-only Credentials, Prisma, and bcrypt dependencies into the Edge runtime, while preserving existing authentication behavior.

## Scope

### In Scope
- Separate the Edge-safe Auth.js configuration from the Node-only Auth.js instance.
- Route middleware through Edge-safe configuration and all handlers, server actions, and server pages through the Node-only instance.
- Preserve JWT/session callbacks, redirects, matcher, custom pages, and `trustHost` unless implementation evidence requires a documented adjustment.
- Accept that existing sessions may be invalidated by deployment.

### Out of Scope
- Node 24 changes or runtime upgrades.
- Prisma deployment configuration, schema, or migrations.
- Authentication product behavior, authorization policy, or UX changes.

## Capabilities

### New Capabilities
- `edge-safe-auth-middleware`: Runtime-safe Auth.js composition that keeps middleware free of Node-only dependencies while retaining current authentication semantics.

### Modified Capabilities
- None.

## Approach

Keep pages, `authorized`, `jwt`, `session`, and `trustHost` in `src/auth.config.ts`. Create `src/auth.ts` to compose that config with Credentials, Prisma, bcrypt, and Zod, exporting `handlers`, `auth`, `signIn`, and `signOut`. Update all Node-side consumers to import from `src/auth.ts`; middleware continues using only `auth.config.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/auth.config.ts`, `src/auth.ts` | Modified/New | Split Edge-safe policy from Node-only authentication. |
| `src/middleware.ts` | Modified | Retain matcher and route authorization without Node-only imports. |
| `src/app/api/auth/**`, `src/actions/**` | Modified | Use Node-only handlers and helpers. |
| `src/app/(routes)/**` | Modified | Use Node-only `auth()` in server pages. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Callback or redirect drift | Medium | Preserve behavior and smoke-test all approved paths. |
| Remaining Edge-to-Node import | Medium | Search all auth imports and require successful Preview deployment. |
| Session invalidation | Medium | Explicitly allow re-authentication after deployment. |

## Rollback Plan

Revert the auth split and importer changes as one unit, restoring `src/auth.config.ts` as the single Auth.js instance; redeploy the last successful build.

## Dependencies

- Preview environment with database access and valid smoke-test credentials.

## Success Criteria

- [ ] Preview deployment completes successfully without Edge bundling errors.
- [ ] Fresh-session smoke tests pass for login, logout, dashboard, exercises, and workouts.
- [ ] JWT/session shape, redirects, matcher, custom pages, and `trustHost` remain unchanged unless a deviation is explicitly justified.
