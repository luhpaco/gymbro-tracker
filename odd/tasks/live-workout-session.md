# Live Workout Session (F1.1)

Objective: a live "workout in progress" mode: start, log sets as they are done, finish; the session lives on the device and syncs on finish.
Branch: `feat/live-workout-session` · Delivery: chain (forecast ~1100 authored lines, above the 400-line heuristic; strategy pending user choice) · Runner: Vitest (`pnpm test`).
Notion: https://app.notion.com/p/3e0b57b76c9b81b1975de50f622e8000 · Epic: https://app.notion.com/p/3e0b57b76c9b81209833dfab1a4f17f1

## Specs

- S1: "Flujo **iniciar → registrar series → terminar**. El formulario actual pasa a ser "agregar entreno pasado" (ticket F1.2)." Only the new flow is in scope here; the existing creation form is left untouched.
- S2: "**Arranque vacío** con ejercicios agregados sobre la marcha, reutilizando el selector de ejercicios existente (cmdk en un Popover)."
- S3: "**Por serie:** peso, reps y marca de calentamiento. RPE y notas van al backlog."
- S4: "Solo ejercicios de peso+reps y de peso corporal (peso 0 permitido)."
- S5: Lifecycle: "Una sola sesión activa por usuario." Decision L2: enforced **per device** (no server registration of the active session). "Aviso visible de "entrenamiento en curso" que persiste al navegar por la app." "Si una sesión lleva más de 12 horas abierta, al volver se pregunta si terminarla o descartarla." "Terminar sin conexión deja la sesión en cola y se sube sola al recuperar señal."
- S6: "**Offline:** la sesión en curso vive en el dispositivo y se sincroniza al terminar. No es local-first completo. El manifest y el service worker van en F1.4."
- S7: "Máquina de estados de la sesión (sin sesión, en curso, terminando, sincronizada, descartada) como **funciones puras** en `src/lib`, testeables con Vitest."
- S8: "Estado de la sesión persistido en el dispositivo y recuperable tras recargar (extiende la idea del borrador actual de `src/lib/workout-draft.ts`)."
- S9: "UI móvil primero: registrar una serie en pocos toques, objetivos táctiles grandes, aviso persistente de sesión en curso."
- S10: "Al terminar, crear el `Workout` con sus `Set` mediante una server action con validación Zod. Debe ser **idempotente** (un id generado en el cliente evita duplicados si se reintenta)."
- S11: "Guardar `startedAt` y `endedAt` del entreno y el orden de las series (modelo de F0.1)." "Descartar sesión y el aviso de sesión abandonada tras 12 horas."
- S12 (acceptance):
  - "El usuario puede iniciar una sesión, agregar ejercicios, marcar series con peso, reps y calentamiento, y terminarla."
  - "Recargar la página o cerrar el navegador no pierde la sesión en curso."
  - "Solo hay una sesión activa y su aviso se ve al navegar por la app."
  - "Una sesión abierta por más de 12 horas ofrece terminarla o descartarla."
  - "Terminar sin conexión no pierde datos y no crea duplicados al sincronizar."
  - "La lógica de estados tiene pruebas unitarias y pasan los gates de CI."
- Out of scope: "Timers (F1.3), PWA y service worker (F1.4), "repetir último entreno" (F1.2), rutinas, RPE, notas."
- Assumption A1 (not in the ticket): the finished workout needs a `name`; it is prefilled ("Entrenamiento" plus the date) and editable on the finish step. `Workout.date` is the day the session started.

## Design decisions (technical, see openspec design.md)

- D1: persistence in `localStorage` under a new versioned key, separate from the draft key; small JSON, synchronous, easy to test behind a storage port. IndexedDB deferred to F1.4 if the service worker needs it.
- D2: per-set "done" timestamp is stored as `Set.createdAt` (column already exists); no migration.
- D3: idempotency: client-generated UUID is the `Workout.id`; a retry that hits the primary key returns the already-created workout (owner-scoped lookup) instead of duplicating.
- D4: no schema change, so no high-risk item 1.

## Tasks

- [ ] T1 (S7, S12-6) — Pure session state machine and types in `src/lib/live-session.ts` (+ tests): start, add/remove exercise, add/edit/mark set, finish, mark synced, discard, 12h staleness. Route: inline.
- [ ] T2 (S8) — Versioned localStorage persistence + pending-sync queue, tolerant of corrupt data, in `src/lib/live-session-storage.ts` (+ tests). Route: inline.
- [ ] T3 (S10, S11) — Zod payload schema + idempotent `finishLiveSession` server action + owner-scoped data function (+ mocked tests). Route: candidate for a delegated writer (disjoint surface, depends only on T1 payload types); decide after the chain strategy is set.
- [ ] T4 (S1-S3, S9) — Client provider/hook + live session page: start, add exercise via existing selector, set rows, finish/discard. Route: inline.
- [ ] T5 (S5) — Persistent "in progress" notice in the navigation shell and 12h stale prompt. Route: inline.
- [ ] T6 (S5, S12-5) — Offline finish queue with auto-sync on reconnect. Route: inline.
- [ ] T7 — Browser verification with agent-browser (test user), docs, archive. Route: inline.

## Log

- L1 (2026-10-19): "Ahora continuando con la siguiente feature" → F1.1 (Notion ticket above, source of truth).
- L2 (2026-10-19): Product decision from the user: "vamos por dispositivo" (single active session enforced per device, not on the server).
- Exploration (2026-10-19): `Workout.startedAt/endedAt` nullable (unwired, spec `workout-session-timestamps`), `Set.order/isWarmup/createdAt` exist; `createWorkout` builds the tag from name+date with collision retry; `buildSetsForCreate` assigns order; navigation shell is `AuthenticatedNavigationShell` in `src/app/(routes)/layout.tsx`; the exercise picker is inline in `WorkoutCreationForm`'s `ExerciseRow`. `/workouts/create` stays as the past-workout form.
