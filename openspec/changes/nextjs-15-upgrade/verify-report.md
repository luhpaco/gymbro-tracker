```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f421953025e1530cc198fb71089685e4464802cf80b7807103af594652d893c5
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 9/9
test_command: pnpm exec tsc --noEmit
test_exit_code: 0
test_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:072303fad98e2ec22ff16b0b19c12ddc7058fdaad67d34a4f8d65636d3e62f62
```

# Verification Report: nextjs-15-upgrade (final pass)

**Supersedes** the prior partial report, which covered Phases 1-5 only and returned `verdict: fail` because the Phase 6 manual checklist was outstanding. Phase 6 is now complete with explicit user sign-off dated 2026-08-10, and a `trustHost: true` fix landed in `src/auth.config.ts` after that report was written. This pass re-verifies the full current candidate.

`evidence_revision` is the SHA-256 of `git diff c8027c7..HEAD` — the three commits that constitute this change (`2d28bb7` upgrade, `18898a3` trustHost fix, `325dddb` SDD artifacts). It differs from the prior report's revision because the trustHost fix and the artifact commit did not exist then.

## Scope of this verification

- **In scope**: all 25 tasks (Phases 1-6), all 6 spec requirements and 9 scenarios, the full diff of `feature/nextjs-15-upgrade` against `origin/master`, and the new `trustHost: true` edit.
- **Working tree**: clean (`git status --porcelain` empty). Local `master` == `origin/master` == `f3a9cd1`.
- **No test runner exists** (`openspec/config.yaml`: `strict_tdd: false`, `runner.available: false`, `verify.test_command: ""`). Per the design's "Testing Strategy (no runner — gates are the test suite)", type-check/lint/build are the executable evidence and the spec's Requirement 5 makes the manual browser checklist the admissible evidence class for runtime scenarios.

## Gate Evidence (executed first-hand during this verification)

| Gate | Command | Exit | Output |
|---|---|---|---|
| Type check | `pnpm exec tsc --noEmit` | 0 | empty (`sha256:e3b0c442…7852b855`) |
| Lint | `pnpm lint` | 0 | 1 pre-existing warning: `react-hooks/exhaustive-deps` at `src/app/auth/login/ui/LoginForm.tsx:65:5`; plus Next 15.5's `next lint is deprecated` notice |
| Build | `pnpm build` | 0 | `✓ Generating static pages (14/14)`; 14 routes emitted; `ƒ Middleware 125 kB`; **zero** matches for `next-auth` / `UntrustedHost` / `AuthError` anywhere in build output |

Build-output triage: `PrismaClientInitializationError` and `DYNAMIC_SERVER_USAGE` messages appear during static-generation attempts for DB-dependent routes. No `POSTGRES_URL` is set in this verification environment, so these are expected non-fatal messages; the build still exits 0 and emits all routes.

## Requirement Compliance Matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Framework and Runtime Version Contract | **VERIFIED** | Lockfile + manifest cross-check (below); `tsc` and `lint` both exit 0 |
| R2 | Auth-Gate Invariant | **VERIFIED (with W-6)** | `src/middleware.ts` byte-unmodified; `authorized()` logic in `src/auth.config.ts` byte-unmodified; middleware bundles at 125 kB; `/api/auth/[...nextauth]` emitted; user-attested manual pass of 6.2/6.3/6.4/6.7 including a successful login and an authenticated write. **Caveat**: one line (`trustHost: true`) was added to `authConfig` — see W-6 |
| R3 | Dynamic Route Params Invariant | **VERIFIED** | Both sites typed `Promise<…>` with `await params` as first statement; repo-wide grep for synchronous `params.slug`/`params.id` and `React.use(` returns zero; both routes build as `ƒ`; user-attested manual render (6.5) |
| R4 | Calendar Component Functional Parity | **VERIFIED** | v9 shadcn variant in place; `initialFocus` → `autoFocus` (repo-wide grep for `initialFocus`: zero); bindings unchanged; user-attested manual open/select/close (6.6) |
| R5 | Manual Verification Checklist | **VERIFIED** | Explicit user sign-off recorded in `tasks.md` dated 2026-08-10 confirming 6.1-6.7 passed, including login and protected-route write |
| R6 | Upgrade Scope Boundary (Non-Goals) | **VERIFIED** | Non-goals audit below, re-run first-hand |

| # | Scenario | Status | Evidence class |
|---|---|---|---|
| R1-S1 | Lockfile resolves pinned versions | **PASS** | Static — lockfile inspection |
| R1-S2 | Type-check and lint pass under the new baseline | **PASS** | Runtime — both commands exit 0 |
| R2-S1 | Logged-out access redirects to login with origin | **PASS** | Manual (6.2), user-attested |
| R2-S2 | Logged-in access redirects away from login | **PASS** | Manual (6.4), user-attested |
| R3-S1 | Workout slug page renders with awaited params | **PASS** | Manual (6.5) + code conformance + build |
| R3-S2 | Exercise update page renders with awaited params | **PASS** | Manual (6.5) + code conformance + build |
| R4-S1 | Date picker opens, selects a date, and closes | **PASS** | Manual (6.6), user-attested |
| R5-S1 | Manual sign-off blocks archive | **PASS** | Sign-off present and dated in `tasks.md` |
| R6-S1 | Out-of-scope work is absent from this change | **PASS** | Static — non-goals audit |

Completed: 6/6 requirements, 9/9 scenarios.

**Evidence-class honesty note**: scenarios R2-S1, R2-S2, R4-S1 and the runtime half of R3-S1/R3-S2 rest on the user's recorded attestation, not on an observation I made myself. The spec deliberately designates manual verification as the admissible evidence class for this project (Requirement 5, "No Automated Test Runner"), so this is contract-compliant — but it is attestation, not machine-reproducible proof, and it will not re-run automatically on the next change.

## 1. Dependency Matrix — VERIFIED

| Package | Requirement | `package.json` | Lockfile resolution | Verdict |
|---|---|---|---|---|
| `next` | 15.x | `15.5.23` | `15.5.23` | PASS |
| `react` | 19.x | `19.2.8` | `19.2.8` | PASS |
| `react-dom` | 19.x | `19.2.8` | `19.2.8` | PASS |
| `next-auth` | exactly `5.0.0-beta.32`, bare | `5.0.0-beta.32` | `5.0.0-beta.32` (single entry; no second version in the lockfile) | PASS |
| `react-day-picker` | `^9` | `^9` | `9.14.0` | PASS |
| `eslint-config-next` | matched to the 15.x line | `15.5.23` | `15.5.23` | PASS — exact match with `next` |
| `@types/react` | React 19 types | `19.2.18` | `19.2.18` | PASS |
| `@types/react-dom` | React 19 types | `19.2.4` | `19.2.4` | PASS |

Installed `node_modules/next-auth/package.json` reports `5.0.0-beta.32`, confirming the manifest, the lockfile, and the installed tree all agree.

Note: `node_modules/.pnpm/` still contains a stale `next-auth@5.0.0-beta.20_next@14.2.3_react-dom@18.3.1…` directory from the pre-upgrade install. It is unreferenced by the lockfile and by `node_modules/next-auth`, so it is inert store residue, not a dual resolution. `pnpm store prune` clears it.

## 2. Async Params Codemod — VERIFIED

- `src/app/(routes)/workouts/[slug]/page.tsx`: `interface Props { params: Promise<{ slug: string }> }`; `const { slug } = await params;` is the first statement, preceding `auth()` and `getWorkoutBySlug(decodeURIComponent(slug), …)`.
- `src/app/(routes)/exercises/update/[id]/page.tsx`: `interface Props { params: Promise<{ id: string }> }`; `const { id } = await params;` is the first statement, preceding `getExerciseById(id, session!.user.id)`.
- Repo-wide greps (task 2.4): `params.slug`/`params.id` → zero; `React.use(` → zero; `searchParams`/`cookies()`/`headers()` → zero, confirming only two async-request call sites exist.

## 3. Calendar Migration — VERIFIED

- `src/components/ui/calendar.tsx` fully replaced with the shadcn v9 variant: `getDefaultClassNames()`, v9 slot keys (`month_grid`, `weekdays`, `day_button`, `button_previous`/`button_next`), a `Chevron` component replacing `IconLeft`/`IconRight`, and a new `CalendarDayButton` export.
- `src/components/workout/SummaryWorkoutForm.tsx`: `initialFocus` → `autoFocus`. Repo-wide grep for `initialFocus`: zero matches.
- Bindings unchanged (task 3.3): `mode='single'`, `selected={field.value}`, `onSelect`, `disabled={(date) => …}`; popover open/close still owned by `isCalendarOpen`.
- API surface: the removed `CalendarProps` export and `Calendar.displayName` have no consumers; `SummaryWorkoutForm.tsx` is the only importer.

## 4. Non-Goals Audit (R6) — VERIFIED CLEAN (re-run)

| Non-goal | Evidence |
|---|---|
| No Turbopack config | `next.config.mjs` contains only the `/` → `/dashboard` redirect; grep for `turbo` in `package.json` and `next.config.mjs` returns zero; scripts remain `next build` / `next dev` |
| No `middleware.ts` → `proxy.ts` rename | `src/middleware.ts` present and byte-unmodified; `src/proxy.ts` absent |
| No ESLint flat-config migration | `.eslintrc.json` present and unmodified; no `eslint.config.*` file exists |
| No Node engine pin | No `engines` field in `package.json`; no `.nvmrc` |
| No `serverExternalPackages` for Prisma | Absent from `next.config.mjs` |
| Product behavior otherwise unchanged | Only source edits: two `await params` sites, the calendar swap, one prop rename, one type annotation, and the `trustHost` line (W-6) |

## 5. Task Completeness

25/25 tasks checked, 0 pending.

- **Phases 1-5 (1.1-5.3, 16 tasks)**: independently corroborated by file inspection or first-hand command execution. Tasks 4.1 and 4.2 were executed exactly as scoped — `git show 2d28bb7 -- CLAUDE.md openspec/config.yaml` shows a one-line stack-string edit in each file and nothing else.
- **Phase 6 (6.1-6.8, 8 tasks)**: now checked, backed by the sign-off block in `tasks.md`: *"User sign-off (2026-08-10): confirmed all of 6.1-6.7 passed, including login + protected-route write (created an exercise) after the `trustHost: true` fix in `src/auth.config.ts`."* Task 6.8's blocking condition is satisfied.

## 6. The `trustHost: true` fix — root-cause analysis

This is the one substantive change not covered by the prior report, so I traced it to source rather than accepting the commit message.

`@auth/core` derives the default in `lib/utils/env.js`:

```js
config.trustHost ?? (config.trustHost = !!(envObject.AUTH_URL ??
    envObject.AUTH_TRUST_HOST ??
    envObject.VERCEL ??
    envObject.CF_PAGES ??
    envObject.NODE_ENV !== "production"));
```

With `pnpm start` (`NODE_ENV=production`) and none of `AUTH_URL` / `AUTH_TRUST_HOST` / `VERCEL` / `CF_PAGES` set locally, `trustHost` resolves to `false` and `assertConfig` returns `UntrustedHost: Host must be trusted`. That exactly matches the failure the user hit during Phase 6, so the fix addresses a real, reproducible defect.

**Critical finding about attribution**: this logic is byte-identical in `@auth/core@0.34.2` (the version behind the pre-upgrade `next-auth@5.0.0-beta.20`) — I read both files. **The `UntrustedHost` failure is therefore pre-existing and would have reproduced identically on the Next 14 / React 18 baseline.** It is not a Next 15 / React 19 regression. Two consequences:

1. **Good news for the change's core risk gate.** The whole change was structured to isolate `nextauthjs/next-auth#11006` — `next-auth@5-beta` middleware breaking under Next 15 / React 19. The one auth failure observed during Phase 6 was *not* #11006-shaped and was not caused by the upgrade. Combined with zero `next-auth` output in the build and a confirmed successful login plus authenticated write, the #11006 risk is **not realised**. No rollback trigger fired.
2. **The fix is out-of-scope for this change.** See W-6.

## Issues

### CRITICAL

None.

### WARNING

**W-6 (NEW) — `trustHost: true` is an undeclared source edit to a file both the proposal and design explicitly marked "no edits", and it is broader than the problem required.**

Both artifacts pin `src/middleware.ts` and `src/auth.config.ts` as *Verify* rows — proposal Affected Areas: "No edits planned; runtime-verified only"; design File Changes: "Verify | No edits; runtime-verified only". The proposal's Out of Scope also states "Any product-behavior change; UI and auth semantics MUST stay identical". Commit `18898a3` edits `authConfig` anyway.

Three separate concerns, in descending importance:

1. **Security surface.** `trustHost: true` unconditionally accepts the incoming `Host` / `X-Forwarded-Host` header for all environments, permanently disabling Auth.js's host assertion. The narrower, standard remedy is an env var — `AUTH_TRUST_HOST=true` in the gitignored local `.env`, or `AUTH_URL` in production — which fixes local `pnpm start` with **zero** source change and **zero** production-behavior change. The current fix is a global, permanent widening to solve a local-only symptom.
2. **It is a no-op where the app actually runs.** This app deploys on Vercel (`VERCEL` is set in that environment), so `trustHost` already resolved to `true` there. The hardcoded value changes nothing on Vercel and only takes effect on self-hosted / proxied deployments — precisely the deployments where host validation matters most.
3. **Attribution.** As shown in §6, the underlying defect is pre-existing, not upgrade-caused. Landing a pre-existing auth-config fix inside a "no product-behavior change" upgrade weakens the change's single-revert story: `git revert 18898a3` and `git revert 2d28bb7` are now two independent decisions rather than one.

*Recommended action (user decision, not a blocker):* replace the source line with `AUTH_TRUST_HOST=true` in the local `.env` (and `.env.template`), or keep the line and explicitly amend the design's File Changes table plus the proposal's Out-of-Scope statement so the artifact trail stops contradicting the code. Do **not** archive with the contradiction silently unresolved.

**W-7 (NEW) — the PR against `origin/master` carries two commits that are not part of this change.**

`origin/master` is at `f3a9cd1`; the branch is five commits ahead, but only three belong to `nextjs-15-upgrade`. The other two — `08e9a67` (CLAUDE.md / `design/` convention) and `c8027c7` (`openspec/` bootstrap) — were unpushed local commits that got swept into PR #1. Effect on the reviewer: `CLAUDE.md` appears as **+122 (new file)** and `openspec/config.yaml` as **+66 (new file)**, which flatly contradicts the design's description of them as one-line stack-string edits. The actual upgrade edit to each is one line (verified via `git show 2d28bb7`). *Action: either say so in the PR description or land the bootstrap commits on `master` separately first.*

**W-1 (carried, unresolved) — `tsconfig.json` gained `"target": "ES2017"` (undeclared, but tool-generated; recommend accepting).** Next.js writes this itself (`node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js` declares `suggested: 'ES2017'`) and appends it to `compilerOptions` on build. Re-running `pnpm build` during this verification produced no further tsconfig mutation, so the file is convergent. Reverting it just makes Next rewrite it. *Action: declare it in the design's File Changes table or accept as tool-generated.*

**W-2 (carried, unresolved) — `src/actions/workout/get-workouts.ts` gained a `WorkoutWithSets` Prisma payload type that the current gates do not require.** Behavior-neutral (a type annotation on a `.map()` callback). The prior verification empirically proved it is not load-bearing: restoring the pre-upgrade version alongside and re-running `tsc --noEmit` compiled clean. Still present in the current tree, and the type literal's indentation is still malformed (misaligned closing braces, though syntactically balanced). *Action: revert for a minimal diff, or explicitly accept. Not a blocker.*

**W-3 (carried, unresolved) — `eslint` was bumped `^8` → `9.39.5`, which the design's dependency matrix never declared.** The design lists the codemod as moving `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint-config-next` — not `eslint` itself. It works today only because `.eslintrc.json` is retained and `next lint` runs ESLint in eslintrc-compat mode. This verification's lint run reproduced the `next lint is deprecated and will be removed in Next.js 16` notice. Once `next lint` disappears, this repo is on ESLint 9 with only an eslintrc file, so the flat-config migration deferred by R6 becomes **mandatory** in `nextjs-16-upgrade`. *Action: record as a hard prerequisite in that change's proposal.*

**W-4 (carried, unresolved) — `package.json` gained a root-level `"overrides"` field that pnpm ignores.** `{"overrides": {"@types/react": "19.2.18", "@types/react-dom": "19.2.4"}}` is npm/yarn syntax; pnpm reads `pnpm.overrides`, and the lockfile confirms it was not honored. Inert today (both types are already pinned exactly in `devDependencies`), but it is dead configuration that would mislead a reader and would activate under npm. *Action: remove it, or convert to `pnpm.overrides`.*

**W-5 (carried, unresolved) — `CLAUDE.md` still documents `next-auth` `5.0.0-beta.20` while the manifest pins `5.0.0-beta.32`.** Confirmed again: `CLAUDE.md:10` reads ``5.0.0-beta.20``; `package.json` and `pnpm-lock.yaml` both carry `5.0.0-beta.32`. Task 4.2 scoped the edit to the stack line only, so this is a task-scoping artifact, not an execution defect. Documentation-only, zero runtime effect. *Action: one-line fix, fold into `sdd-archive`.*

### SUGGESTION

**S-1 (carried) — JD-003 (calendar utilities vs. Tailwind 3.4) is real but cosmetic and confined to unrendered surfaces.** Verified previously against the compiled stylesheet, and the calendar source is unchanged since: `h-[--cell-size]` / `w-[--cell-size]` / `min-w-[--cell-size]` / `size-[--cell-size]` / `px-[--cell-size]` compile correctly under Tailwind 3.4 (bare-custom-property arbitrary values are supported since 3.3). `shadow-xs` and `has-focus:` are Tailwind-v4-only and drop silently, but appear only on `dropdown_root`, which renders only when `captionLayout="dropdown"` — and the consumer uses the default `"label"`. The two `rtl:**:[.rdp-button\_*>svg]:rotate-180` classes also drop (v4-only `**:` variant) and affect RTL chevron mirroring only; the app is LTR. Phase 6.6 confirmed the popover works. No functional regression.

**S-2 (carried) — `package.json` was reformatted from tabs to 2-space indentation by the codemod**, turning a ~10-line semantic change into a 106-line diff and diverging from the tab indentation used across `src/`. Purely cosmetic; worth a line in the PR description so reviewers read the diff semantically.

**S-3 (carried) — `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next` are now exact pins** (previously `^` ranges). Only `next-auth` was specified to be exact; the codemod pinned the whole matrix. Arguably desirable for reproducibility, but it is an undeclared policy shift, and future patch releases now require manual bumps.

**S-4 (NEW) — run `pnpm store prune`** to clear the stale `next-auth@5.0.0-beta.20` / `react@18.3.1` directories still sitting in `node_modules/.pnpm/`. Harmless (unreferenced by the lockfile) but it makes `ls node_modules/.pnpm` misleading during future audits.

## Review Workload

| Metric | Value |
|---|---|
| Authored changed lines (excl. `pnpm-lock.yaml` and `openspec/changes/`) | 377 (274 additions + 103 deletions) |
| Injected budget for this change | 800 |
| Default budget | 400 |
| Verdict | Within budget on both counts. Single PR remains correct; no chained-PR split needed. |

`pnpm-lock.yaml` (3016 changed lines) is excluded per the recorded user decision treating it as generated/mechanical.

## Verdict

**PASS WITH WARNINGS.**

All 25 tasks are complete and independently corroborated. All 6 spec requirements and all 9 scenarios are satisfied. Every gate declared by the design's Testing Strategy passes with first-hand evidence: type-check exit 0 with empty output, lint exit 0 with a single pre-existing warning, build exit 0 emitting all 14 routes and a 125 kB middleware bundle with zero `next-auth` output. The Phase 6 blocking sign-off that made the prior report `fail` is now recorded and dated.

The change's core risk — `next-auth@5-beta` middleware breaking under Next 15 / React 19 (`nextauthjs/next-auth#11006`) — did **not** materialise. The one auth failure encountered during Phase 6 was traced to a pre-existing `trustHost` default that behaves identically on the pre-upgrade baseline, so no rollback trigger fired.

- **0 CRITICAL** — nothing blocks archive; nothing warrants returning to `sdd-apply`.
- **7 WARNING** — W-1 through W-7. W-6 (`trustHost`) is the one that deserves a deliberate user decision before archive, because the code currently contradicts both the proposal and the design and because an env-var remedy is strictly narrower. It is a documentation-and-scope contradiction plus a security-hardening question, not a defect.
- **4 SUGGESTION** — S-1 through S-4.

**Recommended next phase**: `sdd-archive`, after deciding W-6 and folding the one-line W-5 doc fix into the archive step.
