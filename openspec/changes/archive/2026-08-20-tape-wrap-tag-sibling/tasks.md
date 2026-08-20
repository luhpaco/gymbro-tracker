# Tasks: Tape-Wrap Tag Sibling Alignment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 25–60 authored lines across two implementation files |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR containing both atomic presentation edits and validation evidence |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Restore direct-tag sibling structure and preserve ghost tag paint | Single PR | `pnpm exec tsc --noEmit && pnpm lint && pnpm build` | `pnpm dev`; inspect AddExerciseForm and normal/pending SummaryWorkout at desktop/mobile widths | Revert only `src/components/ui/torn-strip.tsx` and `src/components/workout/SummaryWorkout.tsx` |

## Phase 1: Baseline and Contract Checks

- [x] 1.1 Record the current DOM/screenshots for AddExerciseForm and normal/pending SummaryWorkout; confirm only two implementation files may change.
- [x] 1.2 Prepare a temporary uncommitted wrapper probe for direct, Fragment, and wrapper-nested `TornStrip.Tag` cases; do not retain the fixture.

## Phase 2: Core Presentation Implementation

- [x] 2.1 In `src/components/ui/torn-strip.tsx`, partition immediate children with one `React.Children.forEach`; extract only exact `TornStripTag` elements, preserve bucket order, and render tags after the padded content div.
- [x] 2.2 In `src/components/workout/SummaryWorkout.tsx`, replace `[&>span]:bg-transparent` with `[&>span[aria-hidden]]:bg-transparent`; preserve pending tag text/background and all consumer markup.

## Phase 3: Structural, Visual, and Accessibility Validation

- [x] 3.1 Verify direct tags are root-level siblings after content, ordinary content remains padded/unclipped, and Fragment/wrapper-nested tags remain in the content layer.
- [x] 3.2 Compare desktop/mobile screenshots for AddExerciseForm and normal/pending SummaryWorkout; verify overhang, torn clipping, padding, legibility, and layout reservation.
- [x] 3.3 Inspect the accessibility tree and perform a screen-reader pass: paint remains hidden, tag text remains exposed, and labels/values/pending state remain understandable.
- [x] 3.4 Threat matrix is N/A; no RED-test task is applicable. Confirm `AddExerciseForm.tsx` and non-presentation areas are unchanged.

## Phase 4: Quality Gates

- [x] 4.1 Run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`; record exact results and review the final diff/stat.

## Apply Validation Attempt — 2026-08-20

- The local application started with `pnpm dev --port 3210` and served the authentication routes.
- An isolated, dedicated non-production browser account was submitted for registration and login without persisting credentials in repository artifacts. Neither flow established an authenticated session, so `/workouts/create` redirected to `/auth/login?origin=/workouts/create`.
- `docker compose ps` could not run because the Docker CLI is unavailable in this environment. The protected workout route therefore could not be reached for the required `AddExerciseForm` and normal/pending `SummaryWorkout` desktop/mobile screenshots or accessibility-tree checks.
- Tasks 1.1, 3.2, and 3.3 remain unchecked: no visual or accessibility acceptance evidence was inferred from source inspection or the authentication screen.

## Browser Evidence Continuation — 2026-08-20

- A dedicated ephemeral browser account was registered and authenticated against the local production server. Credentials were held only in browser session storage while transitioning from registration to login, then cleared before the authenticated route was opened; no credentials were retained in repository artifacts, OpenSpec, or Engram.
- Task 1.1 is complete: agent-browser captured desktop screenshots of the AddExerciseForm and a SummaryWorkout containing both a normal row and its reserved pending rows. DOM inspection confirmed the direct child sequence is paint span, padded content div, then exposed tag span for the direct set tag and ghost tags.
- The pending-row DOM inspection confirmed two ghost rows, transparent aria-hidden paint spans, visible tag backgrounds, and exposed textual tags. The accessibility snapshot exposed the AddExerciseForm labels and spinbuttons plus the SummaryWorkout labelled normal value controls.
- Task 3.2 remains pending because the active agent-browser `core` profile has no viewport-emulation tool, so an actual mobile-width screenshot was not captured. Task 3.3 remains pending because the available browser accessibility snapshot and DOM checks do not provide an independent screen-reader runtime pass.
- Runtime harness: `pnpm build` exited 0, then `pnpm start -p 3210` served the authenticated workflow on port 3210. The build retained the pre-existing login-form hook warning and expected dynamic-route notices.

## Manual User Evidence Continuation — 2026-08-20

- Task 3.2 is complete from user-supplied mobile evidence: on `/workouts/create`, `SERIE 1` through `SERIE 3` overhang the right TornStrip corner as shown in the supplied captures. Earlier retained desktop captures cover AddExerciseForm and normal/pending SummaryWorkout states.
- Task 3.3 is complete from the user's independent screen-reader confirmation: series labels and weight/repetition values were announced correctly, and the decorative torn-paper paint layer was not announced.
- Separate out-of-scope finding: the register-exercise button and date-picker placeholder have insufficient contrast. This continuation makes no product-code change for that finding.
