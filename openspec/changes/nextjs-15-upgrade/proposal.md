# Proposal: Next.js 15 + React 19 Upgrade (Change 1 of 2)

## Intent

The project is pinned to Next.js 14.2.3 / React 18, which is off the supported line and blocks every future dependency bump. The end goal is Next.js 16, but the highest-risk unknown — whether `next-auth@5-beta` middleware still authenticates under React 19 — is independent of the Next 16 changes (Turbopack default, `middleware`→`proxy` rename, `next lint` removal).

This change takes the **14 → 15** hop only and stops at a live verification checkpoint. The follow-up change `nextjs-16-upgrade` (**not yet created**) runs only after this one is verified and archived.

## Scope

### In Scope

- `next` 14.2.3 → latest 15.x; `eslint-config-next` matched to the same 15.x line
- `react` / `react-dom` 18 → 19; `@types/react` / `@types/react-dom` → React 19 types
- `next-auth` → exactly `5.0.0-beta.32` (pinned, not a dist-tag)
- Async Request API codemod (`next-async-request-api`) at the two `params` call sites: `src/app/(routes)/workouts/[slug]/page.tsx`, `src/app/(routes)/exercises/update/[id]/page.tsx`
- `react-day-picker` v8 → latest stable major, migrating `src/components/ui/calendar.tsx` (v8 `classNames`/`IconLeft`/`IconRight` API is removed) and its consumer `src/components/workout/SummaryWorkoutForm.tsx`
- Lockfile refresh for Radix UI, `cmdk`, `react-hook-form` (already React-19-compatible; no `package.json` range edits)
- Live verification that `src/middleware.ts` + `src/auth.config.ts` still gate and redirect correctly — the change's core risk gate

### Out of Scope (deferred to `nextjs-16-upgrade`)

- Turbopack-by-default handling and `serverExternalPackages` for Prisma
- `middleware.ts` → `proxy.ts` filename/export rename
- `next lint` removal / ESLint flat-config migration
- Node.js 20.9+ pin (`.nvmrc` / `engines`)
- Any product-behavior change; UI and auth semantics MUST stay identical

## Capabilities

### New Capabilities

- `platform-runtime-baseline`: the framework/runtime version contract (Next, React, next-auth, types) plus the auth-gate and dynamic-route invariants that MUST hold unchanged across an upgrade. The follow-up Next 16 change updates this same spec.

### Modified Capabilities

- None. `openspec/specs/` is currently empty.

## Approach

1. Bump `next`, `react`, `react-dom`, `@types/*`, `eslint-config-next` together; pin `next-auth@5.0.0-beta.32`.
2. Run the official `next-async-request-api` codemod, then hand-review both `params` sites (`await params` before use, `Props.params` becomes a `Promise`).
3. Migrate `calendar.tsx` to the new `react-day-picker` class/component API and re-check `SummaryWorkoutForm`'s `mode='single'` + `selected` binding.
4. Gate on `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, then a manual runtime pass on auth.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json`, `pnpm-lock.yaml` | Modified | Version bumps + lockfile refresh |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modified | `await params` |
| `src/app/(routes)/exercises/update/[id]/page.tsx` | Modified | `await params` |
| `src/components/ui/calendar.tsx` | Modified | react-day-picker major API migration |
| `src/components/workout/SummaryWorkoutForm.tsx` | Modified | Calendar prop compatibility |
| `src/middleware.ts`, `src/auth.config.ts` | Verified | No edits planned; runtime-verified only |
| `openspec/config.yaml`, `CLAUDE.md` | Modified | Stack context strings |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `next-auth@5-beta` middleware breaks under Next 15 / React 19 (nextauthjs/next-auth#11006, unresolved) | High | Explicit manual auth checkpoint before archive; exact pin makes the failure reproducible; rollback is one revert |
| react-day-picker major has no drop-in class mapping | Medium | Re-derive `calendar.tsx` from the current shadcn/ui template for the target major |
| Untyped `session.user = token.data as any` breaks under new next-auth types | Medium | Type-check gate; keep the cast if the module augmentation is unchanged |
| No test runner — regressions escape static gates | Medium | `pnpm build` + manual auth/calendar/dynamic-route smoke pass is the accepted gate |
| Radix/cmdk peer-dep warnings on React 19 | Low | Lockfile refresh only; escalate to a range bump only if install fails |

## Rollback Plan

Single-commit (or single-branch) revert: `git revert <sha>` plus `pnpm install --frozen-lockfile` restores 14.2.3 / React 18. No database migration, no schema change, no persisted state is touched, so rollback is fully reversible at any point.

## Dependencies

- Registry availability of `next-auth@5.0.0-beta.32`
- Local PostgreSQL (`docker compose up -d`) for the live auth verification
- None on `nextjs-16-upgrade` — that change is created only after this one archives

## Success Criteria

- [ ] `pnpm exec tsc --noEmit` passes with React 19 types
- [ ] `pnpm lint` passes with the 15.x `eslint-config-next`
- [ ] `pnpm build` succeeds
- [ ] Logged-out access to `/dashboard`, `/exercises`, `/workouts` redirects to `/auth/login?origin=...`
- [ ] Logged-in access to `/auth/login` redirects to `/dashboard`
- [ ] `/workouts/[slug]` and `/exercises/update/[id]` render with awaited `params`
- [ ] Workout date picker opens, selects a date, and closes the popover
- [ ] `next-auth` resolves to exactly `5.0.0-beta.32` in the lockfile
- [ ] No Turbopack, proxy-rename, flat-config, or Node-pin work landed here
