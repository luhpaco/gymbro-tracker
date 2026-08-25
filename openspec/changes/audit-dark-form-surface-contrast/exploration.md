## Exploration: Dark form-surface contrast audit

### Current State
The application is dark-only and maps Tailwind semantic utilities to CSS variables. On `bg-background` (`#0b0a0a`), `text-muted-foreground` (`#a89e8a`) is 7.47:1, so the `/workouts/create` date placeholder is source-level AA-compliant. The exact `Registrar ejercicio` control is an enabled outline `Button`; neither its route nor parent passes `disabled`, so the ticket's claimed disabled state cannot be reproduced from the current source.

The systemic defect is the shared `Button` state: its active `primary`/`primary-foreground` pair is 4.04:1, while `disabled:opacity-50` reduces the effective default-button text-to-fill contrast to 2.67:1. Create/update exercise submits override that to 35% opacity (2.05:1). Calendar disabled days combine `text-muted-foreground` with 50% opacity on the popover surface (2.65:1).

### Affected Areas
- `src/app/globals.css` — defines the dark palette and therefore the measured token contrast pairs.
- `src/components/ui/button.tsx` — shared default-button disabled opacity affects every Button consumer.
- `src/components/ui/calendar.tsx` — disabled days and navigation controls use the same opacity pattern; calendar is used only by `SummaryWorkoutForm`.
- `src/components/workout/DialogAddExercise.tsx` — renders the exact `Registrar ejercicio` label, but without a disabled state.
- `src/components/workout/AddExerciseForm.tsx` — min/max set controls exercise the shared disabled Button state on `/workouts/create`.
- `src/components/workout/SummaryWorkoutForm.tsx` — date placeholder uses `text-muted-foreground` on `bg-background`; its disabled calendar dates need review.
- `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/command.tsx` — placeholders use `muted-foreground` and pass AA on their dark surfaces; their disabled opacity remains a latent shared risk.
- `src/components/ui/select.tsx` — disabled Select uses opacity; its `placeholder:text-muted-foreground` selector does not style Radix's `data-placeholder` trigger state, so current Select placeholders inherit `text-foreground` rather than the muted token.
- `src/components/exercise/CreateExerciseForm.tsx`, `src/components/exercise/UpdateExerciseForm.tsx` — submit controls override the shared disabled opacity to 35%.

### Approaches
1. **Local ticket-class overrides** — change only the reported route controls.
   - Pros: Small diff.
   - Cons: Does not fix the shared Button/Calendar defect; would incorrectly change the currently compliant date placeholder; leaves auth and exercise submits inconsistent.
   - Effort: Low.

2. **Semantic state contrast audit and shared-state remediation** — first reproduce the reported control in the deployed/mobile build, then define AA-measured active and disabled semantic pairs and apply them through shared primitives rather than parent opacity. Correct Radix Select's placeholder-state selector only if the intended muted placeholder treatment is retained.
   - Pros: Addresses verified root causes across buttons, calendar, selects, and form controls without weakening the dark palette; creates a reusable state matrix.
   - Cons: Broader visual regression surface; changing `primary` or shared Button behavior affects many routes.
   - Effort: Medium.

### Recommendation
Choose approach 2. Do not change `muted-foreground` for the date picker: it already passes on the actual surface. Start the proposal with a mobile/deployed-build reproduction of the `Registrar ejercicio` state, then remediate the confirmed shared opacity pattern and the active primary pair with explicit state colors that meet 4.5:1. Treat Select placeholder styling as a separate correctness decision because Radix exposes `data-placeholder`, not an input pseudo-element.

### Risks
- The ticket's exact disabled control conflicts with current source; a stale build, different environment, or visual misidentification could lead to fixing the wrong element.
- A global primary or Button-state change has a wide visual blast radius (22 Button callers) and needs mobile checks for normal, disabled, loading, calendar, and popover states.
- No automated UI test runner exists, so visual contrast verification must be captured through targeted browser/manual QA plus lint, typecheck, and build gates.

### Ready for Proposal
Yes — frame the change as a root-cause contrast remediation, explicitly recording that the named date placeholder is compliant in current source and that the named `Registrar ejercicio` button needs runtime reproduction before it is classified as disabled.
