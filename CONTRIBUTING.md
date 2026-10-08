# Contributing to Gymbro Tracker

Thanks for your interest in improving Gymbro Tracker. This is a public repository, and contributions of all sizes are welcome. Fork the repository and open a pull request; invited collaborators may also push a branch. You do not need any particular tool or workflow to contribute.

## Quick path

1. **Small fixes and documentation** — open a pull request directly.
2. **Substantial features or high-risk changes** — open an issue first so the approach can be agreed before you build.
3. **All changes** — make your change, run focused checks, and open a pull request using the template.

## Before you start

| Change                                  | Recommended approach                           |
| --------------------------------------- | ---------------------------------------------- |
| Typo, docs, or a small bug fix          | Open a pull request directly.                  |
| Substantial feature or high-risk change | Open an issue first and agree on the approach. |

High-risk changes include anything affecting data, authentication, security, or existing users.

## Open a pull request

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and describe:

- **Problem and solution** — what is wrong or missing, and what your change does.
- **Intended behavior** — for behavior changes, what users should observe. Otherwise, write "Not applicable."
- **Verification** — the focused checks you ran and their results.
- **Risks** — compatibility, data, security, or rollout concerns. If there are none, write "None known."

## Tests and CI

- Add focused tests for behavior changes when a meaningful test is practical. If it is not practical, explain why in the pull request.
- CI runs a full `verify` job (lint, formatting, type check, tests, Prisma validation, and build) on pull requests targeting `master`.

## Review and merge

- A maintainer reviews and approves every contribution. CodeRabbit feedback is supplementary, not a substitute for maintainer review.
- **Merge policy:** a passing `verify` check and a maintainer approval are required before merge. Repository-level enforcement settings are managed by maintainers and are not described here.

## Tools and process

Bring whatever tools you like. Gentle AI, ODD, OpenSpec, Engram, Notion, and other agent or specification tooling are **not required** to contribute.

Supporting documents produced by OpenSpec or any other tool are welcome but optional. Maintainers keep the canonical project specifications in sync, so you do not need to update them yourself.

Keep user-facing repository artifacts — documentation, UI copy, and comments — in English.

## Contributor checklist

- [ ] I described the problem, the solution, and the intended behavior.
- [ ] I ran focused checks and reported the results.
- [ ] I documented compatibility, data, security, or rollout risks, or wrote "None known."
- [ ] I added or updated focused tests for behavior changes, or explained why that was not practical.
- [ ] I did not include secrets or unrelated changes.

## Next step

See the [README](README.md) for local setup, then open your pull request.
