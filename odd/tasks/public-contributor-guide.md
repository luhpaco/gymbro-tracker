# Publish the Contributor Guide

## Objective

Publish a tool-agnostic contribution guide for the public repository and link it from the README, aligning it with the user-confirmed contributor policy and the existing pull request template.

## Problem and rationale

The repository is public but has no contributor guide. Its agent instructions describe ODD and Gentle AI, which external contributors must not mistake for requirements. The PR template now establishes a portable contribution contract; the guide must explain how to use it and how maintainers review contributions.

## Scope and constraints

- Create `CONTRIBUTING.md` and link it from `README.md`.
- Include the existing `.github/PULL_REQUEST_TEMPLATE.md` in the final work unit; update it only if necessary to remain consistent.
- Do not require Gentle AI, ODD, OpenSpec, Engram, Notion, or a particular authoring tool from contributors.
- Do not query or change GitHub branch-protection settings. State policy without claiming remote enforcement is configured.
- Do not modify application code or start F0.3.

## Checklist

- [x] **CG-1** — Write the public contribution guidance and link it from the README.
- [x] **CG-2** — Verify guide/template policy consistency, links, formatting, and the final worktree.

## Acceptance criteria

- External contributors can submit PRs from forks; invited collaborators can also use branches.
- Substantial features and high-risk changes are discussed in an issue before implementation; small fixes and documentation changes may be proposed directly.
- Contributors describe the problem, expected behavior, focused verification, and relevant compatibility/data/security risks.
- Focused tests are expected for behavior changes when practical; full CI verification and maintainer approval are required before merge.
- OpenSpec or other supporting documents are welcome but optional; maintainers own canonical project specification updates.
- No contributor is told to install or use a specific agent or specification tool.
- README contains a working relative link to `CONTRIBUTING.md`.
- The guide does not assert that GitHub branch-protection settings have already been configured.

## Checks

- Markdown structural readback and link-target verification.
- `pnpm exec prettier --check README.md CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md`.
- `git diff --check` for tracked changes; directly inspect new files because they are initially untracked.
- This documentation task has no executable behavior and no relevant RED/GREEN test.

## Route and estimate

- Route: delegated direct.
- Trigger: two non-trivial documentation files need coordinated authorship; the writer reads the project README and current PR template while preparing the guide.
- Forecast: approximately 150 authored changed lines; delivery strategy: ask-on-risk (default), no chain forecast.

## Progress and verification evidence

- User confirmed the policy in grill-me: public, tool-agnostic contributions; optional supporting specs; focused tests where relevant; issue-first for substantial/high-risk work; maintainer approval and passing `verify` before merge.
- Current branch: `docs/odd-openspec-workflow`. Existing untracked target `.github/PULL_REQUEST_TEMPLATE.md` is part of this contributor-documentation work unit.
- RDD is off (clone-local).
- Task document created before writing contributor documentation; Engram mirror saved as #3792.
- CG-1 implemented: `CONTRIBUTING.md` authored (tool-agnostic, fork-first, issue-first for substantial/high-risk work, focused tests where practical, policy-not-enforcement merge wording) and linked from `README.md` via a relative link. `.github/PULL_REQUEST_TEMPLATE.md` reviewed and left unchanged (already consistent). Focused checks run: `pnpm exec prettier --check README.md CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md` (exit 0; note `*.md` is listed in `.prettierignore`, so the Markdown check is effectively a no-op) and `git diff --check` (clean for tracked files).
- Parent structural readback caught an overly broad issue-first row that could be read as requiring prior issues for every behavior change; it now applies only to substantial features and high-risk changes, matching the agreed policy.
- Writer check `pnpm exec prettier --check README.md CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md` passed but was a no-op for Markdown because `.prettierignore` lists `*.md`.
- Parent normalized `CONTRIBUTING.md` with `pnpm exec prettier --write --ignore-path /dev/null CONTRIBUTING.md`; then `pnpm exec prettier --check --ignore-path /dev/null README.md CONTRIBUTING.md .github/PULL_REQUEST_TEMPLATE.md` passed.
- Parent `git diff --check` passed; README-to-guide and guide-to-template relative links resolve; whitespace and EOF checks passed for all three Markdown files.
- Native assessment: medium (`executable_change` in the PR template); RDD is off. Writer self-verification and parent structural/command spot-check are recorded.
- Work-unit commit: `2999d9f docs(contributing): add public contribution guide`.

## Next step

CG-1 and CG-2 are complete. Review the separately tracked GitHub branch-protection settings before relying on automatic enforcement.
