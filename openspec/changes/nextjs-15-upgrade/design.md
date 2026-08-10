# Design: Next.js 15 + React 19 Upgrade

## Technical Approach

One dependency-first commit, codemod-assisted and hand-reviewed, landing the `platform-runtime-baseline` version contract without touching product behavior. Static gates run before the build gate; the build gate runs before the manual auth checkpoint. Nothing persisted (no migration, no schema, no seed) is touched, so the whole change stays revert-safe until archive.

## Architecture Decisions

### Decision: Codemod-orchestrated bump, then force the `next-auth` pin

**Choice**: `npx @next/codemod@canary upgrade 15` (interactive; it detects pnpm from `pnpm-lock.yaml`) to move `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint-config-next` as one consistent matrix. It does **not** know about `next-auth`. After it exits: hand-edit `package.json` to `"next-auth": "5.0.0-beta.32"` (bare version, no `^`, no dist-tag), add `"react-day-picker": "^9"`, then `pnpm install` and assert the resolved version in `pnpm-lock.yaml`.

**Alternatives considered**: (a) fully manual `package.json` edits — rejected: loses the codemod's known-good React-19-types/eslint-config pairing; (b) `pnpm up next@15 react@19 react-dom@19` — rejected: skips codemod prompts entirely.

**Rationale**: the codemod owns the matrix it knows; we own the two deps it does not. Letting any tool install a floating `next-auth` range would make the #11006 risk non-reproducible. No `.npmrc` exists, so pnpm treats React-19 peer mismatches (Radix, `cmdk`, `react-hook-form`) as warnings, not install failures — lockfile refresh only, per proposal.

### Decision: Scoped async-params codemod with mandatory hand review

**Choice**: `npx @next/codemod@canary next-async-request-api src/`, then hand-review both sites. Only two exist (grep for `params|searchParams|cookies()|headers()` returns exactly these); no `cookies()`/`headers()`/`searchParams` call sites in the repo.

```ts
// before                              // after
interface Props { params: { slug: string } }
interface Props { params: Promise<{ slug: string }> }

export default async function P({ params }: Props) {
  const { slug } = await params;   // then decodeURIComponent(slug)
```

Same shape for `[id]/page.tsx` (`const { id } = await params`). Reject any codemod output that leaves a synchronous `params.x` read or introduces `React.use()` in these Server Components.

**Alternatives considered**: hand-editing both files. Rejected: the codemod also normalizes the type position, and two files is under its error budget.

### Decision: Re-derive `calendar.tsx` from the shadcn registry, do not map v8→v9 by hand

**Choice**: after `react-day-picker@9` is installed, run `npx shadcn@latest add calendar --overwrite`. The current `src/components/ui/calendar.tsx` is verbatim stock shadcn (`style: default`, no local customisation), so overwrite loses nothing. shadcn ships the v9-compatible variant (`classNames` keys renamed `month_grid`/`weekdays`/`day_button`, `IconLeft`/`IconRight` replaced by a `Chevron` component).

Consumer mapping in `SummaryWorkoutForm.tsx`: `mode='single'`, `selected={field.value}`, `onSelect`, and `disabled={(date) => …}` are unchanged in v9. **One prop changes**: `initialFocus` → `autoFocus`. Popover open/close stays owned by `isCalendarOpen`.

**Alternatives considered**: hand-porting the v8 `classNames` map. Rejected — the key set changed wholesale and shadcn maintains the mapping in lockstep with react-day-picker releases.

## Data Flow — auth gate (unchanged; this is the invariant under test)

```
Browser ─GET /workouts─→ middleware.ts (matcher: all but api/_next/*.png)
                             │  NextAuth(authConfig).auth
                             ▼
                     authorized({ auth, nextUrl })
              ┌──────────────┴──────────────┐
   !isLogged && protected            isLogged && authRoute
              │                              │
   302 /auth/login?origin=<path>      302 /dashboard
              │                              │
              └────────── else: true ────────┴──→ RSC page ─→ auth() ─→ Prisma
```

Note: `LoginForm` lands on `/dashboard` via `window.location.replace`; the `origin` query param is carried but never consumed. Verification asserts the URL contains `?origin=…`, not that login honours it.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` / `pnpm-lock.yaml` | Modify | Version matrix + exact `next-auth` pin |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modify | `params: Promise<…>`, `await params` |
| `src/app/(routes)/exercises/update/[id]/page.tsx` | Modify | `params: Promise<…>`, `await params` |
| `src/components/ui/calendar.tsx` | Modify | Overwritten from shadcn registry (v9) |
| `src/components/workout/SummaryWorkoutForm.tsx` | Modify | `initialFocus` → `autoFocus` |
| `src/middleware.ts`, `src/auth.config.ts` | Verify | No edits; runtime-verified only |
| `openspec/config.yaml`, `CLAUDE.md` | Modify | Stack context strings |

## Testing Strategy (no runner — gates are the test suite)

| Order | Gate | Failure meaning |
|---|---|---|
| 1 | `pnpm exec tsc --noEmit` | Fix forward (types/params/day-picker). Watch `session.user = token.data as any` under beta.32 types. |
| 2 | `pnpm lint` | Fix forward (config drift only). |
| 3 | `pnpm build` | Fix forward once; a build failure originating inside `next-auth` is a **rollback** signal. |
| 4 | Manual runtime pass | Auth failure ⇒ rollback (per user decision). Calendar/route failure ⇒ fix forward. |

**Manual sequence** (`docker compose up -d`, then `pnpm build && pnpm start`, browser in a clean/incognito profile):

1. Logged out → `/dashboard`, `/exercises`, `/workouts` each ⇒ `302` to `/auth/login?origin=/<path>`.
2. Log in with a seeded user ⇒ lands on `/dashboard`, session user is populated (not `undefined`).
3. Logged in → `/auth/login` and `/auth/register` ⇒ `302` to `/dashboard`.
4. `/workouts/<slug>` renders the sets table; `/exercises/update/<id>` renders the edit form (proves awaited `params`).
5. `/workouts/create` → open date popover, pick a date, popover closes, button shows the formatted date.
6. Server log shows no `next-auth` warning/stack during 1–3.

"Verified" = all six pass. A #11006-shaped failure looks like: middleware throwing, `auth?.user` always falsy so logged-in users bounce back to login, or an infinite `/auth/login ↔ /dashboard` redirect loop.

## Threat Matrix

N/A — no routing-policy, shell, subprocess, VCS/PR-automation, or executable-classification boundary is introduced. `middleware.ts` matcher and `authorized()` logic are unchanged by design.

## Migration / Rollout

No data migration. Rollback is a single `git revert <sha>` (or `git checkout master -- package.json pnpm-lock.yaml` pre-commit) followed by `pnpm install --frozen-lockfile`. Because no Prisma migration, schema edit, env var, or persisted state is touched, revert restores 14.2.3 / React 18 exactly. Per the user's decision, an auth-checkpoint failure reverts the **whole** change; do not fall back to another `next-auth` beta.

## Open Questions

- [ ] None blocking. If `pnpm build` surfaces a Prisma/serverless externals issue, it belongs to `nextjs-16-upgrade`, not here.
