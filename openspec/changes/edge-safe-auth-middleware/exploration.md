## Exploration: edge-safe-auth-middleware

### Current State
`src/middleware.ts` constructs an Auth.js instance from `authConfig`, but `src/auth.config.ts` also imports Credentials, `bcryptjs`, Zod, and Prisma. Consequently, the middleware's Edge bundle follows Node-only Prisma/bcrypt imports. The config contains the redirect policy plus the `jwt` and `session` callbacks; it stores the password-free Prisma user object in `token.data`, and the Node-side instance exports `auth`, handlers, `signIn`, and `signOut`.

Login uses `authenticate` from the client login form, which calls `signIn("credentials")`; the API route exposes the same instance's handlers. The sidebar calls the `logout` server action, which calls `signOut({ redirectTo: "/auth/login" })`. Middleware protects the dashboard, exercises, and workouts paths, while server pages/actions also call `auth()` before user-scoped Prisma access. No automated test runner is configured, so Preview smoke testing is required.

### Affected Areas
- `src/auth.config.ts` — must become an Edge-safe configuration object containing pages, authorization, JWT, and session callbacks only.
- `src/auth.ts` — new Node-only Auth.js instance should compose the Edge-safe config with Credentials, Prisma, bcrypt, and validation, then export handlers and auth helpers.
- `src/middleware.ts` — must initialize Auth.js only from the Edge-safe configuration.
- `src/app/api/auth/[...nextauth]/route.ts` — must import handlers from the Node-only Auth.js instance.
- `src/actions/auth/{authenticate,login,logout}.ts` — must import `signIn`/`signOut` from the Node-only instance; logout behavior remains unchanged.
- `src/app/(routes)/dashboard/page.tsx`, `src/app/(routes)/workouts/page.tsx`, `src/app/(routes)/workouts/[slug]/page.tsx`, and `src/app/(routes)/exercises/update/[id]/page.tsx` — page-level `auth()` importers must move to the Node-only instance.
- `src/actions/exercise/get-exercises.ts`, `src/actions/exercise/create-exercise.ts`, and `src/actions/workout/create-workout.ts` — server actions must retain Node-side `auth()` access after the split.

### Approaches
1. **Auth.js documented split** — keep routing and token callbacks in an Edge-safe `auth.config.ts`; create `auth.ts` for the Node-only Credentials provider and Prisma/bcrypt dependencies; have middleware instantiate only the Edge-safe config.
   - Pros: Removes the Edge import chain, preserves the existing JWT and redirect semantics, keeps credentials and database work in the Node runtime, and follows Auth.js v5 guidance.
   - Cons: Requires updating every direct Auth.js importer and retaining two deliberate `NextAuth()` initializations.
   - Effort: Medium

2. **Remove middleware and rely on Node-side page/action checks** — stop initializing Auth.js in middleware and protect routes only through server components and actions.
   - Pros: Avoids an Edge bundle immediately.
   - Cons: Violates the approved middleware separation goal; protection becomes inconsistent (`/exercises` currently relies on an action returning an empty list), and authenticated-route redirects no longer happen centrally.
   - Effort: Low

### Recommendation
Use the documented split. Preserve `trustHost`, custom pages, `authorized`, `jwt`, and `session` callbacks verbatim in the Edge-safe configuration, then compose Credentials/Prisma/bcrypt/Zod in `src/auth.ts`. Redirect and matcher logic are migration-sensitive behavior, not cleanup scope. This change is independent of `vercel-prisma-deploy-fix`; acceptance needs a successful Preview and the approved login, logout, dashboard, exercises, and workouts smoke tests, not production evidence from that other change.

### Risks
- A moved or changed callback can alter the JWT payload/session user shape and cause authenticated requests to be treated as anonymous; preserve callback behavior and validate a fresh Preview login.
- Missing one of the twelve current `@/auth.config` importers can leave handlers or server actions coupled to the obsolete module; update and search all importers before verification.
- The current workout detail fallback redirects to `/login`, not `/auth/login`; middleware currently masks this for protected requests, so do not weaken middleware protection during the migration.
- No test runner exists; Preview smoke tests require a usable Preview database and credentials, and local lint/type/build checks do not replace them.

### Ready for Proposal
Yes — propose the documented Edge-safe/Node-only Auth.js split, keep logout in scope, and make successful Preview plus the five approved smoke paths explicit acceptance criteria.
