# Proposal: Live Workout Session (F1.1)

## Intent

Today a workout is built in one form and saved after the fact. Add an in-progress mode: start a session, log each set when it is done, and finish. This is the base for rest timers (F1.3), PWA/offline (F1.4) and progress charts (F2).

## Scope

- Pure session state machine in `src/lib` (states: none, active, finishing, synced, discarded).
- Session persisted on the device, recoverable after reload; one active session per device.
- Mobile-first live page and a persistent "workout in progress" notice across the app.
- 12-hour stale-session prompt (finish or discard).
- Finish creates the `Workout` and its `Set` rows through an idempotent, Zod-validated server action, writing `startedAt`, `endedAt`, set order and per-set done time. Finish while offline queues and syncs on reconnect.

Out of scope: timers, PWA/service worker, "repeat last workout", routines, RPE, notes, server-side active session, schema changes.

## Behavior deltas

- `workout-session-timestamps`: `startedAt`/`endedAt` are populated by the live-session finish (previously left unwired).
- New capability `live-workout-session` (written during implementation).

## Tasks

Detailed checklist: `odd/tasks/live-workout-session.md` (single source of progress).
