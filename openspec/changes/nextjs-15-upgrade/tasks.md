# Tasks: Next.js 15 + React 19 Upgrade

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (authored, excl. lockfile) | ~250-350 |
| `pnpm-lock.yaml` churn | Large (major bump re-resolves whole tree); mechanical, not hand-authored |
| Effective review budget (injected `review_budget_lines`) | 800 (overrides default 400) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (matches design's "one dependency-first commit") |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not selected — only needed if the lockfile decision below escalates risk to High) |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

**Open decision (name only, do not invent an answer):** should `pnpm-lock.yaml` diff lines count against the 800-line budget, or be treated as generated/exempt (like goldens)? Authored, non-lockfile changes (~250-350 lines: `package.json`, 2 page files, `calendar.tsx` overwrite, 1 prop edit, 2 config strings) stay comfortably under 800 either way. If the user requires counting raw lockfile lines, risk escalates to High and `chain_strategy` becomes a required decision before `sdd-apply`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Dependency matrix bump + `next-auth` pin | PR 1 (single PR) | `pnpm exec tsc --noEmit` | N/A — no runtime behavior yet; covered by Unit 4's manual pass | Part of single-commit revert (see proposal Rollback Plan) |
| 2 | Async params codemod on 2 dynamic routes | PR 1 (single PR) | `pnpm exec tsc --noEmit` | Manual load of `/workouts/<slug>`, `/exercises/update/<id>` | Part of single-commit revert |
| 3 | Calendar v9 migration | PR 1 (single PR) | `pnpm exec tsc --noEmit` | Manual: `/workouts/create` date popover open/select/close | Part of single-commit revert |
| 4 | Config/docs string sync + gates + manual sign-off | PR 1 (single PR) | `pnpm lint && pnpm build` | Full manual sequence in Phase 6 | Part of single-commit revert |

## Phase 1: Dependency Upgrade (Foundation)

- [x] 1.1 Run `npx @next/codemod@canary upgrade 15` to bump `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint-config-next` as one matrix.
- [x] 1.2 Hand-edit `package.json`: pin `"next-auth": "5.0.0-beta.32"` (bare version, no `^`, no dist-tag).
- [x] 1.3 Hand-edit `package.json`: add `"react-day-picker": "^9"`.
- [x] 1.4 Run `pnpm install` to refresh `pnpm-lock.yaml`.
- [x] 1.5 Assert in `pnpm-lock.yaml` that `next-auth` resolves to exactly `5.0.0-beta.32` and `next` resolves to `15.x`.

## Phase 2: Async Request API Migration

- [x] 2.1 Run `npx @next/codemod@canary next-async-request-api src/`.
- [x] 2.2 Hand-review `src/app/(routes)/workouts/[slug]/page.tsx`: `Props.params` typed `Promise<{ slug: string }>`, `await params` precedes use.
- [x] 2.3 Hand-review `src/app/(routes)/exercises/update/[id]/page.tsx`: `Props.params` typed `Promise<{ id: string }>`, `await params` precedes use.
- [x] 2.4 Reject/fix any leftover synchronous `params.x` read or introduced `React.use()` in either file.

## Phase 3: Calendar Component Migration

- [x] 3.1 Run `npx shadcn@latest add calendar --overwrite` to replace `src/components/ui/calendar.tsx` with the v9-compatible variant.
- [x] 3.2 Edit `src/components/workout/SummaryWorkoutForm.tsx`: change the calendar's `initialFocus` prop to `autoFocus`.
- [x] 3.3 Confirm `mode='single'`, `selected={field.value}`, `onSelect`, `disabled={(date) => …}` bindings are unchanged; no further edit needed.

## Phase 4: Documentation & Config Sync

- [x] 4.1 Update `openspec/config.yaml` stack line only: `Next.js 14.2.3` → `15.x`, `React 18` → `React 19`.
- [x] 4.2 Update `CLAUDE.md` stack line only: `Next.js 14.2.3` → `15.x`, `React 18` → `React 19`.

## Phase 5: Static Verification Gates

- [x] 5.1 Run `pnpm exec tsc --noEmit`; fix forward (watch `session.user = token.data as any` under beta.32 types).
- [x] 5.2 Run `pnpm lint`; fix forward config-drift only.
- [x] 5.3 Run `pnpm build`; fix forward once — a failure originating inside `next-auth` is a rollback signal, not a fix-forward signal.

## Phase 6: Manual Verification — Requires Explicit User Sign-Off (NOT sdd-apply-checkable)

- [x] 6.1 [MANUAL] `docker compose up -d`, then `pnpm build && pnpm start`, open a clean/incognito browser profile.
- [x] 6.2 [MANUAL] Logged out: `/dashboard`, `/exercises`, `/workouts` each 302 to `/auth/login?origin=/<path>`.
- [x] 6.3 [MANUAL] Log in with a seeded user: lands on `/dashboard`, session user populated (not `undefined`).
- [x] 6.4 [MANUAL] Logged in: `/auth/login` and `/auth/register` each 302 to `/dashboard`.
- [x] 6.5 [MANUAL] `/workouts/<slug>` renders the sets table; `/exercises/update/<id>` renders the edit form.
- [x] 6.6 [MANUAL] `/workouts/create`: open date popover, pick a date, popover closes, button shows formatted date.
- [x] 6.7 [MANUAL] Server logs show no `next-auth` warning/stack during 6.2-6.4.
- [x] 6.8 [MANUAL — BLOCKING SIGN-OFF] User explicitly confirms all of 6.2-6.7 passed during `sdd-verify`, before `sdd-archive`. A #11006-shaped failure (middleware throwing, `auth?.user` always falsy, infinite `/auth/login ↔ /dashboard` loop) triggers rollback per the proposal's Rollback Plan, not fix-forward.

**User sign-off (2026-08-10)**: confirmed all of 6.1-6.7 passed, including login + protected-route write (created an exercise) after the `trustHost: true` fix in `src/auth.config.ts`.

## Key Learnings

1. Design specifies exact codemod commands (`@next/codemod@canary upgrade 15`, `next-async-request-api`), removing any need to re-derive migration steps.
2. The `next-auth@5-beta` middleware compatibility risk is the single highest-likelihood failure mode and is gated by a mandatory manual sign-off, not an automated check.
3. `pnpm-lock.yaml` churn from a major framework bump is mechanically generated and creates real ambiguity against a fixed line-count review budget.
4. No threat-matrix rows apply to this change because no routing-policy, shell, subprocess, or VCS-automation boundary is introduced.
5. The project's injected `review_budget_lines` of 800 overrides the skill's default 400-line budget for this specific change.
