# Tasks: Edge-Safe Auth Middleware

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 140–230 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Edge-safe split and all importers | Single PR | `pnpm lint && pnpm exec tsc --noEmit && pnpm build` | Preview fresh-session smoke | `src/auth*`, importers, middleware |

## Phase 1: Edge Boundary

- [x] 1.1 RED-EDGE-01: before edits, trace `src/middleware.ts` imports and record failure when Credentials, Prisma, or bcrypt is reachable from `src/auth.config.ts`.
- [x] 1.2 Modify `src/auth.config.ts` into Edge-safe `authConfig`; remove NextAuth, Credentials, Zod, Prisma, and bcrypt imports while preserving pages, `trustHost`, `authorized`, JWT, and session callbacks verbatim.
- [x] 1.3 Verify `src/middleware.ts` remains the sole runtime importer of `auth.config.ts` and its matcher is byte-for-byte unchanged; rerun RED-EDGE-01 green.

## Phase 2: Node Authentication Instance

- [x] 2.1 Create `src/auth.ts`: compose `authConfig` with Credentials, Zod, Prisma, and bcrypt; export `handlers`, `auth`, `signIn`, and `signOut`.
- [x] 2.2 Preserve lowercase email lookup, synchronous password comparison, validation/null invalid-credential outcome, password omission, JWT/session shape, custom pages, redirects, and `trustHost`.

## Phase 3: Node Consumer Migration and Local Gates

- [x] 3.1 Change `src/app/api/auth/[...nextauth]/route.ts` and `src/actions/auth/{authenticate,login,logout}.ts` to import Node helpers from `@/auth`; preserve existing login/logout redirects.
- [x] 3.2 Change `src/actions/exercise/{create-exercise,get-exercises}.ts`, `src/actions/workout/create-workout.ts`, and four server pages under `src/app/(routes)/` to import `auth` from `@/auth`.
- [x] 3.3 Search imports: require exactly one `auth.config` runtime importer (`src/middleware.ts`) and eleven migrated `@/auth` importers; run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.

## Phase 4: Preview Acceptance

- [ ] 4.1 On a Preview with DB/auth environment, record deployment URL/logs showing no Edge bundling or `UntrustedHost` error; reject acceptance on either failure.
- [ ] 4.2 In a fresh browser session, verify protected-route `origin` redirect, invalid and valid login, password-free session, dashboard/exercises/workouts, authenticated login/register redirect, logout to `/auth/login`, and post-logout protection.
- [ ] 4.3 Record whether a pre-deployment session required fresh login; preserve behavior after re-authentication and roll back the complete auth-split work unit if Preview smoke fails.
