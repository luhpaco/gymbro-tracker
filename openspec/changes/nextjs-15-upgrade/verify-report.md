```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2fcd81f819f30e5e2d613d9446f55d771313faa4a905bc7d318ac8bd8f786e94
verdict: fail
blockers: 1
critical_findings: 0
requirements: 2/6
scenarios: 3/9
test_command: pnpm exec tsc --noEmit
test_exit_code: 0
test_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:f24a26cec6149693499ec64a212e39059a23f3dccfc455ab482c2aa4cd5d8101
```

# Verification Report: nextjs-15-upgrade

> **How to read the envelope.** `verdict: fail` and `blockers: 1` mean **verification evidence is incomplete**, not that the implementation is defective. `critical_findings: 0` is the defect count and it is zero. The single blocker is the not-yet-performed Phase 6 manual checklist and its blocking user sign-off (task 6.8), which the spec makes a hard precondition for archive and which is owned separately by the orchestrator. The envelope's passing verdicts are only admissible when every requirement and scenario is covered, and 6 of 9 scenarios here are runtime scenarios that the spec deliberately routes through Phase 6. Phases 1-5 pass cleanly — see the Verdict section.

`evidence_revision` is the SHA-256 of the tracked working-tree diff (`git diff | sha256sum`). It is byte-identical to the Judgment Day target identity, so this verification and the Judgment Day review inspected exactly the same candidate.

## Scope of this verification

- **In scope**: Phases 1-5 (tasks 1.1-5.3) — dependency matrix, async params codemod, calendar migration, config/docs sync, static gates — plus scope-boundary and undeclared-change auditing.
- **Out of scope**: Phase 6 (6.1-6.8), the manual browser checklist and its blocking user sign-off. It is owned separately and remains **OUTSTANDING**. This report does not claim, close, or substitute for it.
- **No test runner exists** for this project (`openspec/config.yaml` → `testing.strict_tdd: false`, `runner.available: false`, `verify.test_command: ""`). Per the design's "Testing Strategy (no runner — gates are the test suite)", the type-check, lint, and build gates are the executable evidence; the `test_command` envelope field records the type-check gate.

## Gate Evidence (executed first-hand during this verification)

| Gate | Command | Exit | Output |
|---|---|---|---|
| Type check | `pnpm exec tsc --noEmit` | 0 | empty (`sha256:e3b0c442…7852b855`) |
| Lint | `pnpm lint` | 0 | 1 pre-existing warning: `react-hooks/exhaustive-deps` at `src/app/auth/login/ui/LoginForm.tsx:65:5`; plus Next 15.5's `next lint is deprecated` notice |
| Build | `pnpm build` | 0 | `✓ Generating static pages (14/14)`; 14 routes emitted; `ƒ Middleware 125 kB` bundled; `.next/BUILD_ID` present |

Harness sanity check: injecting a deliberate type error into a scratch file made `tsc` fail with `TS2322` and a non-zero exit, so the clean exit-0 result is a real pass, not a silently skipped run.

Build-output triage: exactly 2 `PrismaClientInitializationError` and 2 `Dynamic server usage`/`DYNAMIC_SERVER_USAGE` messages appear during static-generation attempts for DB-dependent routes. No `POSTGRES_URL` is configured in this environment, so these are expected non-fatal messages; the build still exits 0. **Zero `next-auth` warnings or stack traces appear anywhere in the build output** — a positive early signal for the #11006 risk, though not a substitute for the Phase 6 runtime check.

## Requirement Compliance Matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Framework and Runtime Version Contract | **VERIFIED** | See dependency table below; both R1 scenarios pass |
| R2 | Auth-Gate Invariant | **PENDING — Phase 6** | Static only: `src/middleware.ts` and `src/auth.config.ts` are byte-unmodified (`git status` shows neither file); middleware bundles at 125 kB and `/api/auth/[...nextauth]` is emitted. Runtime redirect behavior is unproven. |
| R3 | Dynamic Route Params Invariant | **PARTIAL** | Code-level conformance verified (below); both dynamic routes build. Actual page render is Phase 6 (6.5). |
| R4 | Calendar Component Functional Parity | **PARTIAL** | Prop bindings and v9 API verified statically; open/select/close behavior is Phase 6 (6.6). |
| R5 | Manual Verification Checklist | **PENDING — Phase 6** | Blocking user sign-off (task 6.8) not performed. |
| R6 | Upgrade Scope Boundary (Non-Goals) | **VERIFIED** | See non-goals audit below. |

| # | Scenario | Status |
|---|---|---|
| R1-S1 | Lockfile resolves pinned versions | **PASS** |
| R1-S2 | Type-check and lint pass under the new baseline | **PASS** |
| R2-S1 | Logged-out access redirects to login with origin | **PENDING (Phase 6.2)** |
| R2-S2 | Logged-in access redirects away from login | **PENDING (Phase 6.4)** |
| R3-S1 | Workout slug page renders with awaited params | **PENDING RUNTIME (Phase 6.5)** — code conformant |
| R3-S2 | Exercise update page renders with awaited params | **PENDING RUNTIME (Phase 6.5)** — code conformant |
| R4-S1 | Date picker opens, selects a date, and closes | **PENDING (Phase 6.6)** |
| R5-S1 | Manual sign-off blocks archive | **PENDING (Phase 6.8)** |
| R6-S1 | Out-of-scope work is absent from this change | **PASS** |

Completed: 2/6 requirements, 3/9 scenarios. The remaining 4 requirements / 6 scenarios are **not failures** — they are runtime scenarios the spec deliberately routes through the Phase 6 manual checklist.

## 1. Dependency Matrix — VERIFIED

Cross-checked across `package.json`, `pnpm-lock.yaml` (`importers` block), and the installed `node_modules` package manifests. All three agree.

| Package | Spec/design requirement | `package.json` | Lockfile resolution | Installed | Verdict |
|---|---|---|---|---|---|
| `next` | 15.x | `15.5.23` | `15.5.23` | 15.5.23 | PASS |
| `react` | 19.x | `19.2.8` | `19.2.8` | 19.2.8 | PASS |
| `react-dom` | 19.x | `19.2.8` | `19.2.8` | 19.2.8 | PASS |
| `next-auth` | exactly `5.0.0-beta.32`, bare, no `^`/range | `5.0.0-beta.32` | `5.0.0-beta.32` (single entry, no second version anywhere in the lockfile) | 5.0.0-beta.32 | PASS |
| `react-day-picker` | `^9` | `^9` | `9.14.0` | 9.14.0 | PASS |
| `eslint-config-next` | matched to the 15.x line | `15.5.23` | `15.5.23` | 15.5.23 | PASS — exact match with `next` |
| `@types/react` | React 19 types | `19.2.18` | `19.2.18` | 19.2.18 | PASS |
| `@types/react-dom` | React 19 types | `19.2.4` | `19.2.4` | 19.2.4 | PASS |

Every transitive React consumer in the lockfile (`@radix-ui/*`, `cmdk`, `react-hook-form`, `zustand`, `lucide-react`, `@hookform/resolvers`) re-resolved against `react@19.2.8` / `@types/react@19.2.18`, confirming task 1.4's lockfile refresh actually took effect rather than leaving a stale React 18 subtree.

## 2. Async Params Codemod — VERIFIED

`src/app/(routes)/workouts/[slug]/page.tsx`:
- `interface Props { params: Promise<{ slug: string }> }` — correct.
- `const { slug } = await params;` is the **first statement** of the component, preceding `auth()` and `getWorkoutBySlug(decodeURIComponent(slug), …)`.

`src/app/(routes)/exercises/update/[id]/page.tsx`:
- `interface Props { params: Promise<{ id: string }> }` — correct.
- `const { id } = await params;` is the first statement, preceding `getExerciseById(id, session!.user.id)`.

Task 2.4 checks, run as repository-wide greps:
- `params.slug` / `params.id` synchronous reads: **zero matches** in `src/`.
- `React.use(` introduced into a Server Component: **zero matches** in `src/`.
- `searchParams`, `cookies()`, `headers()`: **zero matches** in `src/`, confirming the design's claim that only two async-request call sites exist.

## 3. Calendar Migration — VERIFIED (static)

- `src/components/ui/calendar.tsx` was fully replaced. The pre-upgrade file was confirmed verbatim stock shadcn v8 (`IconLeft`/`IconRight`, `nav_button`, `head_row`, `day_selected` class keys, zero local customization) — the design's premise for the `--overwrite` approach holds, so nothing project-specific was lost.
- The new file is the shadcn v9 variant: `getDefaultClassNames()`, v9 class keys (`month_grid`, `weekdays`, `day_button` slots, `button_previous`/`button_next`), a `Chevron` component replacing `IconLeft`/`IconRight`, and a `CalendarDayButton` export.
- `src/components/workout/SummaryWorkoutForm.tsx`: `initialFocus` → `autoFocus` (task 3.2). Repository-wide grep for `initialFocus`: **zero matches**.
- Task 3.3 bindings confirmed unchanged: `mode='single'`, `selected={field.value}`, `onSelect={(e) => { field.onChange(e); setIsCalendarOpen(false); }}`, `disabled={(date) => …}`. Popover open/close still owned by `isCalendarOpen`, exactly as the design specified.
- API-surface note: the old module exported a `CalendarProps` type and set `Calendar.displayName`; the new one exports `{ Calendar, CalendarDayButton }`. Grep confirms **no consumer** referenced `CalendarProps` or `Calendar.displayName`, and `SummaryWorkoutForm.tsx` is the only importer. No breakage.

## 4. Non-Goals Audit (R6) — VERIFIED CLEAN

| Non-goal | Evidence |
|---|---|
| No Turbopack config | `next.config.mjs` is unmodified and contains only the `/` → `/dashboard` redirect; no `turbo`/`turbopack` key in `next.config.mjs` or `package.json`; build scripts still `next build` / `next dev` with no `--turbopack` flag |
| No `middleware.ts` → `proxy.ts` rename | `src/middleware.ts` present and unmodified; no `src/proxy.ts` exists |
| No ESLint flat-config migration | `.eslintrc.json` present and unmodified (`{"extends": "next/core-web-vitals"}`); no `eslint.config.*` file exists |
| No Node engine pin | No `engines` field in `package.json`; no `.nvmrc` |
| No `serverExternalPackages` for Prisma | Absent from `next.config.mjs` |
| No product-behavior change | `src/middleware.ts`, `src/auth.config.ts` unmodified; the only non-dependency source edits are the two `await params` sites, the calendar swap, and one prop rename |

## 5. Task Completeness

- **Phases 1-5 (tasks 1.1-5.3, 16 tasks)**: all checked, and every one independently corroborated by file inspection or first-hand command execution. No checkbox was found to overstate the code state.
- **Phase 6 (tasks 6.1-6.8, 8 tasks)**: all unchecked, correctly so. Task 6.8 is a **BLOCKING user sign-off** and remains **OUTSTANDING**. It is being handled separately by the orchestrator via live browser testing and was deliberately excluded from this verification.

## 6. Scope Boundary — Undeclared File Changes

`git diff --stat` against the working tree shows 10 modified tracked files plus the untracked `openspec/changes/` artifact directory. Cross-referenced against the design's "File Changes" table:

| File | Declared? | Assessment |
|---|---|---|
| `package.json` | Yes | Expected |
| `pnpm-lock.yaml` | Yes | Expected (3016 lines; excluded from the review budget per the recorded user decision) |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Yes | Expected |
| `src/app/(routes)/exercises/update/[id]/page.tsx` | Yes | Expected |
| `src/components/ui/calendar.tsx` | Yes | Expected |
| `src/components/workout/SummaryWorkoutForm.tsx` | Yes | Expected |
| `openspec/config.yaml` | Yes | Expected — stack line only |
| `CLAUDE.md` | Yes | Expected — stack line only |
| `tsconfig.json` | **No** | **ACCEPT** — see W-1 |
| `src/actions/workout/get-workouts.ts` | **No** | **QUESTION** — see W-2 |

No other undeclared file changes were found. `src/middleware.ts` and `src/auth.config.ts` are untouched, as the design required.

## Issues

### CRITICAL

None.

### WARNING

**W-1 — `tsconfig.json` gained `"target": "ES2017"` (undeclared, but legitimate; recommend accepting).**
This is not hand-authored scope creep. Next.js writes it itself: `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js:79` declares `suggested: 'ES2017'`, and Next appends suggested keys to `compilerOptions` on `next build`/`next dev`. The placement — appended after `paths`, at the end of the block — matches that generator, and the pre-upgrade `tsconfig.json` had no `target` key at all. Re-running `pnpm build` during this verification produced **no further tsconfig mutation**, confirming the file is now convergent with Next 15's defaults. It is a direct consequence of the Phase 5.3 build gate. *Action: declare it in the design's File Changes table (or accept as tool-generated) — do not revert, it will just be rewritten.*

**W-2 — `src/actions/workout/get-workouts.ts` gained a `WorkoutWithSets` Prisma payload type that the current gates do not require.**
The change is behavior-neutral (a pure type annotation on a `.map()` callback), so it carries no runtime risk. However, I empirically tested whether it is load-bearing: I restored the pre-upgrade version of the file alongside the current one (export renamed to avoid a collision) and ran `pnpm exec tsc --noEmit`. It **compiled cleanly with zero errors**, then I removed the probe. So the un-annotated `allWorkouts.map((workout) => …)` type-checks fine under React 19 / Next 15 / TS 5.4.5 as the tree stands today. The annotation may have been necessary at some intermediate moment during apply (e.g. before `prisma generate` had run), but it is **not necessary now**. It is therefore an undeclared, currently-redundant edit. *Action: either revert it to keep the change minimal and single-revert-safe, or explicitly accept it as a harmless carry-over. Not a blocker either way.* Secondary nit: the added type literal's indentation is malformed (misaligned closing braces) even though it is syntactically balanced.

**W-3 — `eslint` was bumped `^8` → `9.39.5`, which the design's dependency matrix never declared.**
The design lists the codemod as moving `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint-config-next` — not `eslint` itself. A major-version bump of the linter arrived silently. It currently works because `.eslintrc.json` is retained and `next lint` runs ESLint in eslintrc-compat mode; `pnpm lint` exits 0. But ESLint 9 defaults to flat config, and Next 15.5 already prints `next lint is deprecated and will be removed in Next.js 16`. Once `next lint` disappears in the follow-up `nextjs-16-upgrade`, this repo will be on ESLint 9 with only an eslintrc file — the flat-config migration deferred by R6 becomes **mandatory** in that change, not optional. *Action: record this as a hard prerequisite in the future `nextjs-16-upgrade` proposal.*

**W-4 — `package.json` gained a root-level `"overrides"` field that pnpm ignores.**
`{"overrides": {"@types/react": "19.2.18", "@types/react-dom": "19.2.4"}}` is npm/yarn syntax. pnpm reads `pnpm.overrides`, and the lockfile confirms it was **not** honored: there is no top-level `overrides:` block in `pnpm-lock.yaml`. The field is currently inert and harmless — both types are already pinned exactly in `devDependencies`, so the intended effect is achieved anyway — but it is dead configuration that would mislead a reader and would suddenly activate under npm. *Action: either remove it or convert it to `pnpm.overrides` for honesty.*

**W-5 — `CLAUDE.md` still documents `next-auth` `5.0.0-beta.20` while the manifest pins `5.0.0-beta.32`.**
Confirmed independently: `CLAUDE.md` line 8 reads ``- **Auth**: Next-Auth 5 (`5.0.0-beta.20`, Credentials provider, middleware-protected routes).`` while `package.json` and `pnpm-lock.yaml` both carry `5.0.0-beta.32`. This exactly matches the Judgment Day info note. Task 4.2 scoped the edit to the stack line only, so the apply phase followed instructions literally and the drift is a task-scoping artifact, not an execution defect. It is documentation-only, with zero runtime effect. *Action: one-line fix, ideally folded into `sdd-archive`.*

### SUGGESTION

**S-1 — JD-003 (calendar vs. Tailwind 3.4) is real but cosmetic and confined to unused surfaces.** I checked the compiled stylesheet (`.next/static/css/88c655566a561a79.css`) rather than reasoning from the source:
- `h-[--cell-size]`, `w-[--cell-size]`, `min-w-[--cell-size]`, `size-[--cell-size]`, `px-[--cell-size]` **do compile correctly** under Tailwind 3.4.3 — the CSS contains `height:var(--cell-size)`, `min-width:var(--cell-size)`, etc. Tailwind 3.3+ already supports the bare-custom-property arbitrary-value shorthand, so the biggest sizing concern is a non-issue.
- `shadow-xs` (a Tailwind v4-only rename of v3's `shadow-sm`) produces **0 rules** — silently dropped. It appears only on `dropdown_root`, which renders only when `captionLayout="dropdown"`. The consumer uses the default `captionLayout="label"`, so it never renders.
- The two `rtl:**:[.rdp-button\_*>svg]:rotate-180` classes produce **0 rules** — the `**:` descendant variant is Tailwind v4-only. This affects RTL chevron mirroring only; the app is LTR.
- `has-focus:` (also v4-only) produces **0 rules**, again only on the unrendered `dropdown_root`.

Net: the uncorroborated single-judge finding is factually accurate about v4-only utilities being present, but the impact is confined to a caption layout this app never renders and to RTL support it does not use. No functional regression is expected. Phase 6.6 should still eyeball the popover.

**S-2 — `package.json` was reformatted from tabs to 2-space indentation by the codemod**, turning a ~10-line semantic change into a 106-line diff. Purely cosmetic, but it inflates reviewer load and diverges from the tab indentation used across `src/`. Worth a note in the PR description so reviewers know to read the diff semantically.

**S-3 — `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next` are now exact pins** (previously `^` ranges). Only `next-auth` was specified to be an exact pin; the codemod pinned the whole matrix. This is arguably desirable for reproducibility, but it is an undeclared policy shift and future patch releases will now require manual bumps.

## Judgment Day Cross-Check

`judgment-day-feedback.md` reports `target_identity: 2fcd81f819f30e5e2d613d9446f55d771313faa4a905bc7d318ac8bd8f786e94`. Recomputing `git diff | sha256sum` against the current working tree yields the **identical** hash, so nothing changed between the Judgment Day review and this verification — the two passes inspected exactly the same bytes.

| JD item | Independently observed? |
|---|---|
| `terminal_state: approved`, zero corroborated BLOCKER/CRITICAL | **Confirmed** — this verification also found zero CRITICAL |
| JD-003 (Tailwind 3.4 vs. calendar utilities, single judge) | **Confirmed as real but narrower than feared** — see S-1; compiled-CSS evidence shows the sizing utilities work and only unused-surface utilities drop |
| Info: React 19 paired with React-18 peer ranges | **Confirmed** — Radix, `cmdk`, `react-hook-form` declare peers through React 18; `autoInstallPeers: true` in the lockfile means pnpm resolved them as warnings, not failures. Phase 6 browser validation of forms, dialogs, popovers, selects and toasts remains the required evidence |
| Info: stale `next-auth` version string in CLAUDE.md | **Confirmed** — see W-5; the described `beta.20` vs `beta.32` inconsistency genuinely exists and is informational only |
| `fix_work_units: []` | **Consistent** — no fix work unit is required to unblock; W-1..W-5 are all non-blocking |

Judgment Day also reported "the ten tracked files listed in the reviewed diff", which matches the ten modified tracked files observed here — so JD saw `tsconfig.json` and `get-workouts.ts` too and did not flag them as defects.

## Verdict

**Phases 1-5: PASS WITH WARNINGS. Change overall: verification INCOMPLETE (envelope `fail`) pending Phase 6.**

Every gate declared by the design's Testing Strategy passes with first-hand evidence: type-check exit 0 with empty output, lint exit 0 with a single pre-existing warning, build exit 0 producing all 14 routes and a 125 kB middleware bundle. The dependency contract, both async-params sites, the calendar migration, and all six non-goals are verified against actual file contents rather than checkbox state.

- **0 CRITICAL** — no implementation defect was found, and nothing here warrants returning to `sdd-apply`.
- **5 WARNING** — W-1 through W-5; none blocks archive on its own.
- **3 SUGGESTION** — S-1 through S-3.
- **1 blocker** — the outstanding Phase 6 manual sign-off, which is a process gate the spec mandates, not a code defect.

## OUTSTANDING — Phase 6 (handled separately, NOT closed by this report)

Spec Requirement "Manual Verification Checklist (No Automated Test Runner)" and its scenario "Manual sign-off blocks archive" are **not satisfied**. Tasks 6.1-6.8 remain unchecked, and **6.8 is an explicit blocking user sign-off**. Static gates explicitly do NOT substitute for it.

`sdd-archive` MUST NOT run until:
1. 6.2-6.7 are exercised against a running instance (`docker compose up -d`, `pnpm build && pnpm start`, clean/incognito profile), and
2. the user explicitly confirms 6.8.

The highest-residual risk remains the one the whole change was structured to isolate: `next-auth@5.0.0-beta.32` middleware behavior under Next 15 / React 19 (`nextauthjs/next-auth#11006`). Static evidence is encouraging — the middleware bundles, `/api/auth/[...nextauth]` is emitted, and no `next-auth` warning or stack appears anywhere in the build output — but a #11006-shaped failure (middleware throwing, `auth?.user` always falsy, an infinite `/auth/login ↔ /dashboard` loop) is only observable at runtime. Per the recorded user decision, an auth-checkpoint failure triggers a **full revert of the whole change**, not a fix-forward and not a different beta pin.

Also worth exercising during Phase 6, given the React-18 peer ranges: dialogs, selects, toasts, and the command palette (`cmdk`), not just the calendar popover.
