# Design: Edge-Safe Auth Middleware

## Technical Approach

Apply Auth.js v5's split-configuration pattern. `src/auth.config.ts` becomes an Edge-safe policy object; `src/auth.ts` composes it with Credentials authorization and exports the Node-only Auth.js API. The middleware remains rooted only in the policy object, while every current `@/auth.config` importer moves atomically to `@/auth`. This satisfies the Edge-boundary, Node-instance, behavior-preservation, and Preview-acceptance requirements without changing authentication UX.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Shared Edge-safe policy plus Node-only composition | Two Auth.js initializations must share identical policy and environment secrets. | **Selected.** Keep the current `pages`, `trustHost: true`, `authorized`, `jwt`, and `session` configuration in `auth.config.ts`; add Credentials/Prisma/bcrypt/Zod only in `auth.ts`. This removes Node-only transitive imports without introducing authentication behavior changes. |
| One configuration with conditional/dynamic Node imports | Smaller diff, but bundlers can still follow imports and runtime checks obscure the boundary. | Rejected. |
| Change callbacks, redirect strings, matcher, or authorization matching while splitting | Could clean up existing quirks, but risks behavioral drift. | Rejected; preserve them verbatim and address separately. |

## Data Flow

```text
Edge request -> middleware.ts -> NextAuth(authConfig).auth
                              -> authorized callback -> allow/redirect

Login/API/RSC/action -> auth.ts -> Credentials -> Zod -> Prisma -> bcrypt
                              -> jwt callback -> token.data
                              -> session callback -> session.user
```

Both instances use the same `AUTH_SECRET`, callbacks, pages, cookie defaults, and `trustHost`, so middleware consumes fresh Node-issued sessions consistently under the existing configuration. Existing cookies may continue working; invalidated cookies are explicitly handled by fresh login. Password remains removed before the user reaches JWT/session callbacks.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/auth.config.ts` | Modify | Export only Edge-safe config (`providers: []` if required by the type), preserving current pages, policy callbacks, and `trustHost`; remove Credentials, Zod, Prisma, bcrypt, and `NextAuth()` exports. |
| `src/auth.ts` | Create | Compose `{ ...authConfig, providers: [Credentials(...)] }`; preserve validation, lowercase lookup, synchronous bcrypt comparison, password omission, and exports `handlers`, `auth`, `signIn`, `signOut`. |
| `src/actions/auth/{authenticate,login,logout}.ts` | Modify | Import Node-only `signIn`/`signOut` from `@/auth`; retain invalid-credential outcomes and logout redirect. |
| `src/actions/exercise/{create-exercise,get-exercises}.ts`, `src/actions/workout/create-workout.ts` | Modify | Import Node-only `auth` from `@/auth`. |
| `src/app/(routes)/dashboard/page.tsx`, `src/app/(routes)/workouts/page.tsx`, `src/app/(routes)/workouts/[slug]/page.tsx`, `src/app/(routes)/exercises/update/[id]/page.tsx` | Modify | Import Node-only `auth` from `@/auth`; do not alter redirects. |
| `src/app/api/auth/[...nextauth]/route.ts` | Modify | Import Node-only `handlers` from `@/auth`. |
| `src/middleware.ts` | Retain/verify | Remain the sole `auth.config` runtime importer and preserve the exact matcher. |

## Interfaces / Contracts

`auth.config.ts` exports `authConfig: NextAuthConfig`; `auth.ts` is the only source of Node helpers. The current JWT contract remains `token.data = user`; session materialization remains `session.user = token.data`. No importer may obtain helpers from `auth.config.ts`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| RED architecture | Edge import closure | Before production edits, run `RED-EDGE-01`: trace from `src/middleware.ts` and fail on reachable Credentials, Prisma, or bcrypt; current graph must fail. Re-run green after the split. |
| Local gates | Composition and types | Run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`; confirm exactly one `auth.config` importer and eleven migrated `@/auth` importers. |
| Preview acceptance | Runtime and behavior | Deploy with Preview DB/auth environment; logs must show no Edge bundling or `UntrustedHost` error. In a fresh browser: verify protected-route redirect with existing `origin`, invalid login, valid login, password-free session shape, dashboard/exercises/workouts, authenticated login/register redirect, logout to `/auth/login`, and post-logout protection. Record URL and log/smoke evidence; local gates cannot substitute. |

## Threat Matrix

| Boundary | Cases | Applicability | Safe / failure behavior | Planned RED tests |
|---|---|---|---|---|
| Edge import graph | Direct/transitive Credentials, Prisma, bcrypt | **Applicable** | Safe: middleware closure is Edge-compatible. Failure: any forbidden dependency blocks acceptance. | `RED-EDGE-01` above; carry unchanged into tasks. |
| Documentation-like paths | Executable-looking docs | N/A: no file classification/execution | None | None |
| Git repository selection | Relative/absolute repository selectors | N/A: no VCS automation | None | None |
| Commit state | Staged/index variants | N/A: no commit automation | None | None |
| Push state | Tracking/refspec variants | N/A: no push automation | None | None |
| PR commands | Head/environment/composed commands | N/A: no PR automation | None | None |

## Migration / Rollout

No data migration required. Land the split and all eleven importer changes atomically, pass local gates, then require Preview deployment and fresh-session smoke evidence before promotion. Roll back the whole unit if bundling or behavior fails.

## Open Questions

None.
