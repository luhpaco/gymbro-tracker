# Notes: nextjs-15-upgrade

Continuous log per the `sdd-cross-harness-handoff` skill (Rule 2). Updated throughout the phase, not reconstructed at close.

## Phase 1 — Claude Code (propose → tasks)

- **Scope decision (user)**: incremental 14→15→16 confirmed over a direct jump, specifically to isolate the next-auth beta + React 19 + middleware compatibility risk (GitHub `nextauthjs/next-auth#11006`, closed "not planned") from Next-16-specific work (Turbopack default, `middleware`→`proxy` rename, `next lint` removal, Node 20.9+ pin). Those are deferred to a not-yet-created `nextjs-16-upgrade` change.
- **next-auth version (user)**: pinned to exactly `5.0.0-beta.32` (first beta declaring `next: ^16.0.0` peer-dep support), not a floating dist-tag.
- **react-day-picker (user)**: in scope for this change (forced by the React 19 bump anyway). Approach: re-derive `calendar.tsx` from shadcn/ui's own updated calendar registry entry (`npx shadcn@latest add calendar --overwrite`) rather than hand-mapping the v8 API — current `calendar.tsx` is verbatim stock shadcn with zero local customization, confirmed by design-phase code inspection. User explicitly wants "feature parity" (similar behavior to what exists now), not a from-scratch redesign — the shadcn registry approach was validated as consistent with that intent.
- **Rollback trigger (user)**: if the auth checkpoint fails on `beta.32`, full revert of the whole change — do not try a different beta pin as a fallback.
- **Spec shape (user)**: single shared capability `platform-runtime-baseline`, designed for reuse — the future `nextjs-16-upgrade` change updates this same spec rather than creating a new one.
- **Verification ownership (user)**: manual checklist (Phase 6 in tasks.md, 8 items) with explicit blocking user sign-off during `sdd-verify` — no test runner exists in this project.
- **Review budget decision (user)**: `pnpm-lock.yaml` diff is excluded from the 800-line review budget (treated as generated/mechanical, like a golden file). Authored changes are ~250-350 lines — single PR, no chained-PR strategy needed.
- **Deviation found during design**: `LoginForm.tsx` calls `window.location.replace("/dashboard")` unconditionally and never reads the `origin` query param that `auth.config.ts`'s `authorized` callback sets on redirect. Verification scenarios were written to assert `?origin=...` is present in the redirect URL, NOT that login actually returns the user there — avoids a false-regression report during manual verification.
- **Tooling gap observed**: Engram MCP tools (`mem_save`, `mem_search`, `mem_get_observation`) were unavailable in every phase sub-agent's execution context this session (explore, propose, spec, design, tasks). The orchestrator (Claude Code) mirrored every artifact to Engram manually after each phase. Worth investigating separately why phase sub-agents don't inherit Engram tool access in this environment.
- **Artifacts produced**: `proposal.md`, `design.md`, `specs/platform-runtime-baseline/spec.md`, `tasks.md` — all in `openspec/changes/nextjs-15-upgrade/`, mirrored to Engram under `sdd/nextjs-15-upgrade/{proposal,spec,design,tasks}`.

## Phase 2 — OpenCode (apply → Judgment Day)

_Pending — not started yet._

## Phase 3 — Claude Code (verify → archive → closing prompt)

- **sdd-verify ran for Phases 1-5** (`verify-report.md`): 0 CRITICAL, 5 WARNING (W-1..W-5), 3 SUGGESTION (S-1..S-3). All independently confirmed against actual files/gates, not just tasks.md checkboxes. Orchestrator independently re-ran `tsc --noEmit`/`pnpm lint`/`pnpm build` and confirmed the same results.
- **New findings from verify** (not previously surfaced by Judgment Day or design):
  - W-3: `eslint` silently bumped `^8` → `9.39.5` (design only declared `eslint-config-next`). Works today via `.eslintrc.json` compat mode, but makes the ESLint flat-config migration **mandatory** (not optional) in the future `nextjs-16-upgrade` change once `next lint` is removed. Carry this into that change's proposal.
  - W-4: `package.json` gained an inert root-level `"overrides"` field (npm/yarn syntax; pnpm reads `pnpm.overrides` and ignores this). Harmless but should be removed or converted before archive.
- **Open decisions for the user, not yet resolved**:
  - W-2: `src/actions/workout/get-workouts.ts` gained a `WorkoutWithSets` type annotation empirically proven NOT load-bearing (tested by restoring the pre-upgrade version alongside and re-running `tsc --noEmit` — compiled clean either way). Revert to keep the diff minimal, or accept as harmless? Not decided yet.
  - W-5: `CLAUDE.md` still says `next-auth 5.0.0-beta.20` though the manifest pins `5.0.0-beta.32` (task 4.2 scoped the edit to the stack line only). Informational only; normally folded into `sdd-archive`.
- **Phase 6 (manual browser checklist, 6.1-6.8) is PAUSED, not abandoned.** Orchestrator attempted to set up a throwaway local `.env` + Postgres to drive the checklist itself via browser automation, but `.env` write was denied by permission settings (deliberately not bypassed). User then clarified: this is a project inherited from another machine, local dev env (`.env`, Postgres, etc.) was never brought over and isn't ready yet. **Decision: defer Phase 6 to later, once the user's local environment is set up.** No commit, push, PR, or archive happens before Phase 6 is complete and 6.8 is explicitly signed off. `nextjs-15-upgrade` stays in its current state (uncommitted working tree) until then.
- **To resume**: user sets up `.env` (from `.env.template` — note `POSTGRES_URL` is what `schema.prisma` actually reads, `.env.template`'s `DATABASE_URL` var name is a pre-existing, out-of-scope repo inconsistency) + `docker compose up -d`, then either runs 6.1-6.8 by hand or asks the orchestrator to drive it via browser automation once the env exists.
