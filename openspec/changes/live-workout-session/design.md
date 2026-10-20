# Design: Live Workout Session (F1.1)

## Decisions

- **Single active session per device.** Chosen by the owner. The session lives only on the device and is uploaded when finished. A second device can start its own session; nothing is lost because every upload is idempotent.
- **Storage: `localStorage`.** The session is a small JSON document written on every change. `localStorage` is synchronous, trivially testable behind a small storage port, and already used for the workout draft. A distinct versioned key (`gymbro:live-session:v1`) keeps it independent from the draft key. IndexedDB is deferred until F1.4 proves it is needed.
- **Per-set done time.** Stored in `Set.createdAt` (existing column, defaults to `now()`), set from the client's done time. No migration. Ordering stays server-owned through `order`.
- **Idempotency.** The client generates a UUID when the session starts and it becomes `Workout.id`. A retry that collides on the primary key returns the existing owner-scoped workout instead of inserting again. A tag collision (`userId`+`tag`) keeps the existing suffix-retry behavior.
- **Pure core.** All transitions (including the 12-hour staleness rule, with the clock injected) are pure functions in `src/lib`, so the rules are unit-tested without DOM tests.

## Risks

- Corrupt or old stored data: parsing is schema-validated and falls back to "no session" without throwing.
- Storage unavailable or full: persistence is best-effort like the draft; the in-memory session keeps working.
- Reusing `createWorkout` internals: the tag builder, collision retry and `buildSetsForCreate` are reused rather than reimplemented, to keep ordering and tag invariants identical.
