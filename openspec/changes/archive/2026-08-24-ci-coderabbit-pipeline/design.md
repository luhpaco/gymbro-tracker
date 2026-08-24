# Design: CI Pipeline + CodeRabbit Review Configuration

## Technical Approach

Two sequential PRs into `master`. PR 1 lands Prettier and a one-time repo-wide format pass over code/config only. PR 2 branches from the already-formatted `master` and lands the CI workflow (including `format:check`), CodeRabbit config, ESLint/Prettier reconciliation, and a minimal Vitest Stage 1 setup. Everything is additive and independently revertable per the proposal's rollback plan.

## Architecture Decisions

### Decision: Stacked-to-main chain, not a feature-branch chain

**Choice**: `master → format-pass` (PR 1, merge) → `master → ci-pipeline` (PR 2, branched after the merge).
**Alternatives considered**: feature-branch chain (tracker branch, PR 2 targeting PR 1's branch); single combined PR.
**Rationale**: decisive constraint — `ci.yml` declares `on.pull_request.branches: [master]`. A PR targeting a non-`master` branch would not trigger the workflow at all, so PR 2 could not self-verify the gate it introduces. Targeting `master` after PR 1 merges also guarantees `prettier --check .` sees only already-formatted code. A tracker branch buys nothing for a 2-node linear dependency. A single PR would mix a ~70-file mechanical diff with reviewable tooling, violating the proposal's review-budget mitigation.

### Decision: Prettier config mirrors the codebase's dominant hand-written style

**Choice**: tabs, double-quoted TS strings, single-quoted JSX attributes, semicolons, `printWidth: 80`, `trailingComma: "all"`, with a 2-space override for JSON/YAML.
**Alternatives considered**: pure Prettier 3 defaults (2 spaces, `jsxSingleQuote: false`); `trailingComma: "es5"`.
**Rationale**: evidence from the tree — tab indentation in 66 hand-written files (2809 lines) vs. 2 spaces in 14 vendored shadcn/ui files; `className='…'` dominant, `className="…"` only 16 times and only inside shadcn primitives; double quotes universal in TS. Deviate from Prettier defaults only where a dominant, intentional convention exists. Absence of a trailing comma on hand-broken call arguments is not a convention, so Prettier 3's `"all"` default stands. JSON/YAML stay at 2 spaces because the ecosystem's own writers (`pnpm`, `shadcn`) emit that and YAML forbids tabs outright.

### Decision: `eslint-config-prettier` ships in PR 2, not PR 1

**Choice**: PR 1 adds only `prettier`; PR 2 adds `eslint-config-prettier` together with the `.eslintrc.json` edit that uses it.
**Alternatives considered**: front-load both in PR 1.
**Rationale**: `next/core-web-vitals` enables no stylistic formatting rules (`indent`, `quotes`, `semi` are absent), so the format pass cannot conflict with `pnpm lint` in PR 1. Shipping a dependency one PR before its only consumer is dead weight.

### Decision: placeholder CI env vars are labelled, not random-looking

**Choice**: `POSTGRES_URL=postgresql://ci:ci@127.0.0.1:5432/gymbro_ci?schema=public` and `AUTH_SECRET=ci-placeholder-not-a-real-secret`, both job-level `env:`.
**Alternatives considered**: a random-looking high-entropy `AUTH_SECRET`; GitHub Actions secrets.
**Rationale**: `prisma generate`/`validate` parse `env("POSTGRES_URL")` at invocation and fail when unset, independent of connectivity — so a syntactically valid loopback URL is required and nothing ever dials it. A value that *looks* like a credential invites a future reader (and secret scanners) to treat it as one; a self-describing label cannot be mistaken for production. Real secrets are never needed because no CI step reaches the network or the database.

### Decision: `AUTH_SECRET` is set unconditionally

**Choice**: always export it; do not make the workflow depend on resolving whether `next build` strictly requires it.
**Rationale**: `src/app/(routes)/dashboard/page.tsx`, `workouts/page.tsx`, `workouts/[slug]/page.tsx`, and `exercises/update/[id]/page.tsx` each `await auth()` in a server component. `next build` runs with `NODE_ENV=production` and trial-renders those routes; NextAuth v5 derives a development secret but requires `AUTH_SECRET` in production, so a `MissingSecret` throw during that trial render is plausible. Cost of setting it: one line. Cost of guessing wrong: a red pipeline. This closes the exploration's open question by making the answer irrelevant — apply still confirms the build passes with placeholders only.

### Decision: `.coderabbit.yaml` stays in PR 2

**Choice**: follow the confirmed PR split.
**Rationale**: keeps PR 1 single-purpose. Consequence, accepted: CodeRabbit resolves `.coderabbit.yaml` from the PR's **base branch**, so PR 1 and PR 2 are themselves reviewed with CodeRabbit defaults and the `chill` profile governs PR 3 onward. PR 1's diff is whitespace-and-quotes only, so a default-profile review of it carries little signal either way.

## Data Flow

Delivery sequence (the load-bearing flow):

    master ──┬─────────────────────────────────────────────────► master (formatted + gated)
             │                                     ▲                        ▲
             └─► PR 1  format-pass ────────────────┘                        │
                 • prettier devDep, .prettierrc, .prettierignore            │
                 • format/format:check scripts                              │
                 • `pnpm exec prettier --write .`  (separate commit)        │
                 • no CI exists yet → verified locally + `pnpm build`       │
                                                                            │
                          (merge first — hard ordering barrier)             │
                                                                            │
                              └─► PR 2  ci-pipeline ─────────────────────────┘
                                  branched from formatted master
                                  • .github/workflows/ci.yml, .coderabbit.yaml
                                  • eslint-config-prettier + .eslintrc.json
                                  • vitest + vite-tsconfig-paths + tests
                                  • openspec/config.yaml + CLAUDE.md flip
                                  • its own CI run is green because base is formatted

PR 2 must not be branched before PR 1 merges. If it is, `format:check` fails against legacy code and the failure is indistinguishable from a real regression.

CI job step order (fail cheap first):

    checkout → pnpm/action-setup → setup-node(24.x, cache: pnpm) → install --frozen-lockfile
      → pnpm lint → pnpm format:check → tsc --noEmit → pnpm test → prisma validate → pnpm build

## File Changes

| File | PR | Action | Description |
|------|----|--------|-------------|
| `.prettierrc` | 1 | Create | Formatter rules (below) |
| `.prettierignore` | 1 | Create | Scope guard: build output, tool-owned files, `openspec/`, markdown |
| `package.json` | 1 | Modify | `prettier` devDep; `format`, `format:check` scripts |
| ~70 files under `src/`, `prisma/`, root configs | 1 | Modify | One-time format pass, its own commit |
| `.github/workflows/ci.yml` | 2 | Create | Single sequential PR gate |
| `.coderabbit.yaml` | 2 | Create | Review profile, path instructions, path filters |
| `vitest.config.ts` | 2 | Create | Node environment, `@/*` alias via `vite-tsconfig-paths` |
| `.eslintrc.json` | 2 | Modify | `extends` becomes an array, `"prettier"` last |
| `package.json` | 2 | Modify | `eslint-config-prettier`, `vitest`, `vite-tsconfig-paths`; `test`, `test:watch` |
| `src/store/{ui,exercises,workouts,workout}/*-store.test.ts` | 2 | Create | Colocated store tests |
| `src/lib/schemas/workout-set.test.ts`, `src/lib/utils.test.ts` | 2 | Create | Colocated schema/util tests |
| `openspec/config.yaml` | 2 | Modify | `testing` block, `rules.apply.test_command`, `rules.verify.test_command`, formatter block |
| `CLAUDE.md` | 2 | Modify | Testing section: runner and formatter now exist |

## Interfaces / Contracts

`.prettierrc` (only `useTabs` and `jsxSingleQuote` deviate from Prettier 3 defaults; the rest are restated for a two-agent project):

```json
{
  "useTabs": true,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false,
  "jsxSingleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "arrowParens": "always",
  "endOfLine": "lf",
  "overrides": [
    {
      "files": ["*.json", "*.yaml", "*.yml"],
      "options": { "useTabs": false, "tabWidth": 2 }
    }
  ]
}
```

`.prettierignore`:

```
node_modules/
.next/
out/
build/
coverage/
postgres/
.codegraph/
design/
pnpm-lock.yaml
prisma/migrations/
next-env.d.ts
openspec/
*.md
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
```

`environment: "node"` because Stage 1 renders no component. `include` is `.ts` only, matching the colocated pure-logic targets; Stage 2 widens it to `.tsx`. `tsconfig.json`'s `include: ["**/*.ts"]` already covers `vitest.config.ts` and every `*.test.ts`, so `tsc --noEmit` type-checks them with no tsconfig change; tests import `describe`/`it`/`expect` from `vitest` explicitly rather than enabling `globals`.

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [master]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      POSTGRES_URL: "postgresql://ci:ci@127.0.0.1:5432/gymbro_ci?schema=public"
      AUTH_SECRET: "ci-placeholder-not-a-real-secret"
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24.x
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm exec tsc --noEmit
      - run: pnpm test
      - run: pnpm exec prisma validate
      - run: pnpm build
```

`pnpm/action-setup@v4` takes no `version` input on purpose: it reads `packageManager: pnpm@11.21.0` from `package.json`, keeping one source of truth. Passing both can conflict. It must precede `setup-node` so `cache: pnpm` can resolve the store. `node-version: 24.x` mirrors `engines.node`.

`.coderabbit.yaml`:

```yaml
language: en-US
reviews:
  profile: chill
  auto_review:
    enabled: true
  path_filters:
    - "!design/**"
    - "!openspec/changes/archive/**"
    - "!prisma/migrations/**"
    - "!pnpm-lock.yaml"
  path_instructions:
    - path: "src/actions/**/*.ts"
      instructions: >-
        Server actions must validate every input with a Zod schema before
        touching Prisma. Flag raw or untyped input reaching the database.
    - path: "src/components/**/*.tsx"
      instructions: >-
        Components consume the data layer; they must not call Prisma directly.
        Files are kebab-case or PascalCase per the existing folder convention;
        imports use the @/ alias.
    - path: "src/lib/**/*.ts"
      instructions: >-
        Shared utilities and Prisma access live here or in src/data/. Keep
        query logic out of components.
    - path: "prisma/schema.prisma"
      instructions: >-
        Schema changes require a matching migration folder committed together.
        Never hand-edit generated migration SQL.
```

`path_filters` is the correct field for exclusion (`!` prefix); `path_instructions` carries guidance only. `prisma/migrations/**` is filtered rather than instructed so CodeRabbit never flags generated SQL.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Zustand stores (`ui`, `exercises`, `workouts`, `workout`) | Colocated `*-store.test.ts`; call actions on the vanilla store, assert state transitions; reset state between tests |
| Unit | `src/lib/schemas/workout-set.ts` | `safeParse` happy path plus each `min` violation, including string coercion |
| Unit | `src/lib/utils.ts` (`cn`) | Class merge precedence and conditional-class cases |
| Integration | N/A Stage 1 | Deferred (Stage 3, Postgres service container) |
| E2E | N/A | Out of scope |
| Pipeline | The gate itself | PR 2's own CI run is the acceptance test: all seven steps green against formatted `master` |

## Threat Matrix

The change adds declarative CI configuration, not agent-composed shell or VCS commands.

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A — no file is classified or executed by content type; `.prettierignore` scopes formatting only. |
| Git repository selection | N/A — no `git -C` or path-derived repository selection is authored. |
| Commit state | N/A — no index/worktree manipulation logic is introduced. |
| Push state | N/A — no ref or refspec resolution is authored; GitHub resolves the PR ref. |
| PR commands | N/A — no composed PR command; the trigger is a static `on.pull_request` declaration. |

## Migration / Rollout

No data migration. Rollout is the two-PR sequence above. Branch protection stays off, so CI is advisory until the user enables it — a red check does not block merge, which is deliberate for the first pipeline.

## Open Questions

- [ ] `.env.template`'s exact key list is inferred from code, not read (agent tooling denies `.env*`). Human confirms once during apply that `POSTGRES_URL` and `AUTH_SECRET` are the only build-relevant keys.
- [ ] Apply must run `pnpm build` locally with only the placeholder env vars before wiring `ci.yml`, per the proposal's mitigation.
- [ ] CodeRabbit's base-branch config resolution is assumed, not verified; confirm cheaply by observing whether PR 3 reflects the `chill` profile.
