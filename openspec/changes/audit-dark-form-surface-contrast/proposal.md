# Proposal: Audit Dark Form Surface Contrast

## Intent

Close the reported `/workouts/create` dark-surface legibility issues using the authenticated mobile and desktop screenshot evidence, while preserving the current dark-only identity and all existing behavior.

## Scope

### In Scope
- Make the outlined `Registrar ejercicio` trigger legible.
- Preserve legibility for the calendar open state and selected-date value and icon.
- Make exercise-added metadata and the intentional empty pending reservation visually clear.
- Make the primary `Guardar entrenamiento` action legible.
- Close the named states with authenticated mobile and desktop screenshot validation.

### Out of Scope
- A new theme, visual redesign, or unrelated accessibility remediation.
- An exhaustive Button-caller audit, all-control state inventory, or mandatory computed-ratio evidence matrix.
- Changes to form submission behavior, validation, data, routes, or server actions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `visual-design-system`: Require legible presentation for the named workout-creation states, validated by authenticated mobile and desktop screenshots, without changing behavior.

## Approach

Apply the smallest token or presentation-class changes required by the named flows. Treat the supplied authenticated screenshots as closeout evidence for those flows only; they do not establish a full control audit or computed contrast inventory. Keep the trigger state, calendar interaction, pending-reservation semantics, and save behavior unchanged.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/globals.css` | Modified | Targeted semantic foreground or border tokens, if required. |
| `src/components/ui/{button,calendar}.tsx` | Modified | Presentation of the outlined trigger, primary action, and calendar states. |
| `src/components/workout/{DialogAddExercise,SummaryWorkoutForm}.tsx` | Modified | Targeted workout-create metadata and pending-reservation presentation. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Screenshot evidence is visual only | Med | Limit acceptance to the named rendered states; preserve behavior. |
| Shared style change affects another surface | Med | Keep changes minimal and recheck the named mobile and desktop flows. |

## Rollback Plan

Revert the isolated token or presentation-class changes. No schema, persisted data, route, validation, event, or behavioral migration is involved.

## Dependencies

- Authenticated mobile and desktop screenshot evidence for `/workouts/create`.

## Success Criteria

- [ ] Authenticated mobile and desktop screenshots show a legible outlined `Registrar ejercicio` trigger, calendar open state, selected date value/icon, exercise-added metadata, pending reservation, and primary save action.
- [ ] The pending reservation remains intentionally empty; its visible boundary and tag do not imply missing workout data.
- [ ] The affected flows remain presentation-only: no submission, validation, calendar interaction, route, data, or server-action behavior changes.
