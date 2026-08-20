# Apply Progress: Tape-Wrap Tag Sibling Alignment

## Status

Standard mode. This cumulative record retains the implementation, static-validation, and authenticated desktop-browser evidence from earlier batches. This continuation closes the remaining visual and accessibility tasks exclusively with user-supplied manual evidence; it ran no command, browser automation, or production-code change.

## Completed Tasks

- [x] 1.1 Record the current DOM/screenshots for AddExerciseForm and normal/pending SummaryWorkout; confirm only two implementation files may change.
- [x] 1.2 Prepare and run a temporary direct/Fragment/wrapper child-partition probe without retaining a fixture.
- [x] 2.1 Partition immediate TornStrip children in one React.Children.forEach pass and render exact direct tags after the padded content div.
- [x] 2.2 Restrict SummaryWorkout ghost transparency to the aria-hidden paint span.
- [x] 3.1 Statically inspect the rendered child order and verify the direct-child traversal boundary with the temporary probe.
- [x] 3.2 Compare desktop/mobile screenshots for AddExerciseForm and normal/pending SummaryWorkout; verify overhang, torn clipping, padding, legibility, and layout reservation.
- [x] 3.3 Inspect the affected accessibility tree and complete an independent screen-reader pass.
- [x] 3.4 Confirm the threat matrix is N/A and that AddExerciseForm plus non-presentation source areas are unchanged by this work unit.
- [x] 4.1 Run the configured type, lint, build, diff, and structural checks.

## Pending Tasks

None.

## Work Unit Evidence

| Evidence | Result |
| --- | --- |
| Focused test command and exact result | Retained prior evidence: `node -e '<React.Children direct-tag probe>' && git diff --check && pnpm exec tsc --noEmit && pnpm lint && pnpm build` exited 0. The probe reported `tags=1, content=3`; the Fragment and wrapper remained content-layered. TypeScript exited 0. ESLint exited 0 with one pre-existing `react-hooks/exhaustive-deps` warning in `src/app/auth/login/ui/LoginForm.tsx:65`. A later `pnpm build` also exited 0, with the same warning and expected dynamic-server notices during static generation. |
| Runtime harness command/scenario and exact result | Retained prior evidence: `pnpm start -p 3210` served the production build on local port 3210. A dedicated ephemeral browser account registered and logged in successfully; credentials were cleared from browser session storage before the authenticated route was opened. The harness visited `/workouts/create`, opened AddExerciseForm, selected a minimal non-destructive exercise, and added one normal set row that produced two reserved pending rows. |
| Desktop visual evidence | Retained prior evidence: agent-browser captured desktop AddExerciseForm and full-page SummaryWorkout screenshots containing normal and pending states. The direct tag visibly overhangs the torn root; padded content and pending tag backgrounds remain visible. Screenshots were inspected transiently and not retained as repository or SDD artifacts. |
| Manual mobile visual evidence | User-supplied evidence: on mobile `/workouts/create`, `SERIE 1` through `SERIE 3` overhang the right TornStrip corner as shown in the supplied captures. No image was retained by this continuation. |
| Manual screen-reader evidence | User-supplied independent screen-reader confirmation: series labels and weight/repetition values were announced correctly; the decorative torn-paper paint layer was not announced. |
| Structural inspection | CodeGraph confirmed the updated root order is aria-hidden paint span, padded content div, then the extracted tag bucket. The predicate is exact identity: `React.isValidElement(child) && child.type === TornStripTag`; it does not traverse Fragment or wrapper descendants. |
| Rollback boundary | Revert only `src/components/ui/torn-strip.tsx` and `src/components/workout/SummaryWorkout.tsx` to undo the presentation correction; revert the validation notes in `openspec/changes/tape-wrap-tag-sibling/tasks.md` and `openspec/changes/tape-wrap-tag-sibling/apply-progress.md` independently. This continuation did not modify production code. |

## Scope and Delivery

- Delivery strategy: `ask-on-risk`; the 25–60 line estimate remains below the 400-line review budget.
- Work unit: 1 — restore direct-tag sibling structure and preserve ghost tag paint.
- Product files modified before this validation continuation: `src/components/ui/torn-strip.tsx`, `src/components/workout/SummaryWorkout.tsx`.
- This continuation modified only `openspec/changes/tape-wrap-tag-sibling/tasks.md` and `openspec/changes/tape-wrap-tag-sibling/apply-progress.md`. No API, consumer markup, text, routes, actions, data, or AddExerciseForm source was changed.

## Deviations and Issues

No design deviation. The remaining manual evidence was supplied and confirmed by the user rather than inferred from source inspection. A separate user-reported contrast issue affects the register-exercise button and date-picker placeholder; it is explicitly out of scope for this change and received no code modification.
