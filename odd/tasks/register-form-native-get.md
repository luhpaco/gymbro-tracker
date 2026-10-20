# Register form native GET fix
Objective: prevent credential-bearing native GET submissions in registration and login forms.
Branch: `fix/register-form-native-get` | Delivery: single local work-unit commit | Tests: Vitest (`pnpm test`)

## Specs

### S1 — Prevent credential leakage before hydration
Source: Notion ticket “Bug: el formulario de registro se envía como GET nativo antes de hidratar y filtra la contraseña en la URL”.

> if the `/auth/register` form is submitted BEFORE React finishes hydrating, the browser does a native submit with method GET. All fields, including password and confirmPassword, end up in the query string, e.g. `/auth/register?firstName=Test&email=...&password=...&confirmPassword=...`. The user is not created.

> The form must never perform a GET with data. Declare `method="post"` or use a server action as `action`, or disable the submit button until hydrated.

Acceptance: browser-native pre-hydration submission cannot put form credentials in a URL; hydrated registration continues to work and preserves existing Zod/react-hook-form validation and `registerUser` behavior. Verify login under the same criteria and fix it if affected.

Checks: native browser form submission bypassing React for register and login; successful registration after hydration; `pnpm test`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm build`.

### S2 — Keep scope limited
> Out of scope: password recovery, email verification, redesigning the forms, any other file not needed for this fix.

Acceptance: no unrelated behavior, schema, migration, or other auth flow changes.

## Tasks

- [x] T1 (S1–S2) — inline; explicit POST on both forms and browser verification completed. Commit: `10237c1`.

## Log

### L1 — Original request
You are working in an isolated git worktree of gymbro-tracker, branch `fix/register-form-native-get` (based on `master`). Stay inside this directory; never touch `/home/luhpaco/projects/gymbro-tracker` (the main checkout, which has another session's uncommitted/in-flight work).

Read `CLAUDE.md` and `.claude/rules/*.md` first and follow them. Work follows ODD: create `odd/tasks/register-form-native-get.md` as the single detailed checklist (header; `## Specs` with numbered S# quoting the issue text verbatim; `## Tasks`; `## Log` with L1 = this request verbatim) and a brief `openspec/changes/register-form-native-get/proposal.md` plus a `tasks.md` that only points to the ODD checklist.

Issue (Notion ticket, source of truth)

Title: "Bug: el formulario de registro se envía como GET nativo antes de hidratar y filtra la contraseña en la URL"
Notion: https://app.notion.com/p/3ffb57b76c9b81c699f5ccd2c24b6e97

Problem: if the `/auth/register` form is submitted BEFORE React finishes hydrating, the browser does a native submit with method GET. All fields, including password and confirmPassword, end up in the query string, e.g. `/auth/register?firstName=Test&email=...&password=...&confirmPassword=...`. The user is not created.

Repro: `pnpm dev`, open `/auth/register` in a fresh browser, fill the fields and click "Registrarse" immediately, before the Next.js Dev Tools button appears (hydration). Final URL contains the password and no user is registered. Likely hits slow mobile connections, the app's main device. `/auth/login` probably has the same pattern: verify it and fix it too if so.

Impact: plaintext password in URL (browser history, proxy/server logs, Referer); the user sees nothing happen and must retry.

Suggested scope: the form must never perform a GET with data. Declare `method="post"` or use a server action as `action`, or disable the submit button until hydrated. Review `src/app/auth/register/ui/RegisterForm.tsx` and the login form with the same criteria. Test whatever is testable (pure logic; there are no component/DOM tests in this project). Verify by hand with a browser without waiting for networkidle.

Out of scope: password recovery, email verification, redesigning the forms, any other file not needed for this fix.

Rules and constraints

- Prefer the smallest change that makes a pre-hydration submit impossible to leak data. Explain the tradeoff you picked in the ODD log. Keep existing validation (Zod / react-hook-form) and the `registerUser` server action behavior intact.
- Test-first where a runnable deterministic test exists: observe RED, then GREEN. Add one test per existing behavior your change touches. Tests are co-located `*.test.ts`.
- Environment in this worktree: Postgres on host port 5433, dev server on port 3001 (see `.worktree-port`; run with `PORT=3001 pnpm dev`). The database is fresh, so the shared local test user does not exist here: register it through the UI using `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` from `.env.local` (never print or commit the password).
- Browser checks: use agent-browser if available. To reproduce the bug, submit before hydration; to verify the fix, confirm no credential ever appears in the URL and the registration works after hydration.
- Before finishing, all of these must pass: `pnpm test`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm build`. Stop the dev server before `pnpm build`.
- Artifacts (code, comments, docs, tests, commit messages) in English. Conventional Commits. Do NOT add Co-Authored-By or any AI attribution.
- Commit locally on this branch in reviewable slices (tests and docs with the behavior). Do NOT push, do NOT open a PR, do NOT change Notion, do NOT run `prisma migrate` or edit migrations (no schema change is expected).
- Never commit secrets or `.env*`.

Final report

Reply with: what you changed (files), RED/GREEN evidence, result of each gate command, the browser verification you did (including the login form), commit hashes, anything you skipped, and `Risk: item N (reason)` or `Risk: none`. Close with a `## Key Learnings` block of 1-5 numbered factual sentences.

### L2 — Initial evidence and implementation choice
The register and login forms are plain client form elements using `onSubmit` without an explicit `method`; HTML therefore defaults to GET before React handles the event. Browser baseline: the rendered register form reported `method: get`, and a native submit with synthetic values navigated to `/auth/register?firstName=Leak&lastName=Probe&email=leak-probe%40example.invalid&password=synthetic-probe-secret&confirmPassword=synthetic-probe-secret`.

Both forms include password fields, so both share the exposure. Use explicit `method="post"` as the smallest defensive change: it prevents credential query-string disclosure without changing the hydrated React Hook Form submit path, though a pre-hydration POST still reloads the page and does not create the user. The repo has no component/DOM test harness, so validate the rendered method and actual navigation in a browser; do not add brittle source-text tests.

### L3 — Implementation and verification
Added explicit `method='post'` to both auth forms; Zod schemas, React Hook Form handlers, and server actions remain unchanged. Native-submit browser checks after the edit called the browser's native `HTMLFormElement.prototype.submit()` (bypassing React), reported `method: post` for each form, and remained on `/auth/register` and `/auth/login` without credential query parameters. Registration with the `.env.local` test account succeeded and redirected to `/auth/login`; logging into that account succeeded and redirected to `/dashboard`. Browser opening did not hold the page before hydration, so strict pre-hydration timing was not captured; the native submission path was directly exercised instead. No network-idle wait was used before browser submission.

The deterministic Vitest suite covers no component/DOM boundary, so no source-text test was added. `pnpm test` passed (31 files, 409 tests); `pnpm lint` passed; `pnpm exec tsc --noEmit` passed; `pnpm build` exited successfully (existing Jose Edge Runtime warnings and a dynamic-server-usage diagnostic for `/workouts/create` appeared). Targeted Prettier check passed for all changed source and documentation files. The required full `pnpm run format:check` remains blocked by the pre-existing dirty `opencode.json`, which was not changed because it belongs to other in-flight work in this worktree.

Risk: none — the requested form submission semantics changed explicitly; no shared helper, persisted data, security boundary, or external API was changed.

Rollback boundary: revert `10237c1` to remove the explicit POST form method and its task/change documentation; no unrelated files need to change.
