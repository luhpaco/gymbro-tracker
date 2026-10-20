# Live Workout Session (F1.1)

Objective: a live "workout in progress" mode: start, log sets as they are done, finish; the session lives on the device and syncs on finish.
Branch: `feat/live-workout-session` (tracker) · Delivery: `feature-branch-chain` (forecast ~1100 authored lines; user choice 2026-10-19, "como en F0.2"). Each slice PR targets the tracker branch; the final PR goes tracker -> `master`. · Runner: Vitest (`pnpm test`).

Slices (PRs into the tracker): S-A = T1+T2 (`feat/lws-core`); S-B = T3 (`feat/lws-finish-action`); S-C = T4+T5 (`feat/lws-ui`); S-D = T6+T7 (`feat/lws-offline-verify`).
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

## Contract between T1 (client state) and T3 (server action)

Fixed here so the two units can be built independently; the only seam is this payload.

- Input `FinishLiveSessionInput` (Zod schema `FinishLiveSessionSchema` in `src/lib/schemas/live-session.ts`, owned by T3):
  - `sessionId`: UUID, becomes `Workout.id` (idempotency key).
  - `name`: non-empty string (reuse the name rule of `AddWorkoutFormSchema`).
  - `startedAt`, `endedAt`: dates (`endedAt >= startedAt`); `Workout.date` = `startedAt`.
  - `exercises`: non-empty array, in logged order, of `{ exerciseId: UUID, sets: non-empty array of { weight, reps, isWarmup, doneAt } }`. `weight`, `reps`, `isWarmup` reuse the shared `setSchema` rules (weight >= 0, no upper bound); `doneAt` is a date used as `Set.createdAt`. `order` is never client input.
- Result `FinishLiveSessionResult`: `{ ok: true, workout }` or `{ ok: false, code }` with `code` one of `unauthorized | invalid_input | exercise_not_found | duplicate_tag | error`.
- Rules: every `exerciseId` must belong to the authenticated user (`exercise_not_found` otherwise, indistinguishable from a missing id). A retry with an existing `sessionId` owned by the same user returns `{ ok: true }` with the existing workout and creates nothing; an id owned by another user returns `error` without leaking it. Reuse `buildWorkoutTag`/`nextTagCandidate`/`isWorkoutTagCollision` for the tag and `order` assignment from `buildSetsForCreate`'s approach.
- T1 exposes `toFinishInput(session, endedAt)` producing exactly this shape.

## Tasks

- [x] T1 (S7, S12-6) — Pure session state machine and types in `src/lib/live-session.ts` (+ tests): start, add/remove exercise, add/edit/mark set, finish, mark synced, discard, 12h staleness. Route: inline.
- [x] T2 (S8) — Versioned localStorage persistence + pending-sync queue, tolerant of corrupt data, in `src/lib/live-session-storage.ts` (+ tests). Route: inline.
- [ ] T3 (S10, S11) — Zod payload schema + idempotent `finishLiveSession` server action + owner-scoped data function (+ mocked tests). Route: candidate for a delegated writer (disjoint surface, depends only on T1 payload types); decide after the chain strategy is set.
- [x] T4 (S1-S3, S9) — Client provider/hook + live session page: start, add exercise via existing selector, set rows, finish/discard. Route: inline.
- [x] T5 (S5) — Persistent "in progress" notice in the navigation shell and 12h stale prompt. Route: inline.
- [ ] T6 (S5, S12-5) — Offline finish queue with auto-sync on reconnect. Route: inline.
- [ ] T7 — Browser verification with agent-browser (test user), docs, archive. Route: inline.

## Log

- L1 (2026-10-19): "Ahora continuando con la siguiente feature" → F1.1 (Notion ticket above, source of truth).
- L2 (2026-10-19): Product decision from the user: "vamos por dispositivo" (single active session enforced per device, not on the server).
- Exploration (2026-10-19): `Workout.startedAt/endedAt` nullable (unwired, spec `workout-session-timestamps`), `Set.order/isWarmup/createdAt` exist; `createWorkout` builds the tag from name+date with collision retry; `buildSetsForCreate` assigns order; navigation shell is `AuthenticatedNavigationShell` in `src/app/(routes)/layout.tsx`; the exercise picker is inline in `WorkoutCreationForm`'s `ExerciseRow`. `/workouts/create` stays as the past-workout form.
- S-A (2026-10-20, branch `feat/lws-core`): T1+T2 done inline. RED observed for both modules (module missing), GREEN: 21 + 9 tests. All five CI gates exit 0. Design note: the persisted `finishing` state is the upload queue (one session per device), so no separate queue structure exists. `toFinishInput` returns `null` unless the state is `finishing`; seam with T3's schema is checked at integration.
- S-B (2026-10-20, branch `feat/lws-finish-action`, OpenCode in a separate worktree, commit 3fea99e): T3 done by a delegated writer; parent re-ran test/lint/format/tsc (exit 0) and read the diff against the contract. Minor notes: redundant `if (!result.ok || !result.created) return result; return result;` in the data function; `exercises`/`sets` arrays have no upper bound.
- S-C (2026-10-20, branch `feat/lws-ui`): T4+T5 implemented inline. Pure logic first (RED then GREEN): `reopenSession` (so a server refusal never strands the user in the upload queue), Zustand `live-session-store` (33 tests with the S-A ones), `shouldShowLiveSessionBanner` (+4 tests). UI: `/workouts/live` page, `LiveSessionScreen`, `LiveSetRow`, `ExercisePicker`, `LiveSessionBanner`, `StaleSessionPrompt`, "Start workout" create action. The existing creation form was left untouched (the picker reuses the same Popover/Command primitives instead of extracting from `ExerciseRow`). Finish uploads on mount if a finishing session is found; auto-retry on reconnect is T6.
- Caught late: the first edit that mounts the banner and prompt in the shell silently did not apply (indentation mismatch) while all gates stayed green, because there are no component tests. Fixed with an exact edit; browser verification (T7) is what proves they render.
- S-C browser verification + impeccable audit (2026-10-20, agent-browser at 390x844, local DB, test user): start -> add exercise -> edit weight/reps -> mark done -> reload keeps the session (localStorage) -> banner on `/dashboard` -> finish uploaded to the real DB and redirected to the workout detail. DB row checked: `startedAt`/`endedAt` set, `date = startedAt`, `order = 0`, `Set.createdAt = doneAt`, localStorage cleared. A seeded 13h-old session showed the stale prompt and "Descartarlo" cleared it. Not covered in the browser: offline finish/auto-sync (T6), discard confirm sheet, "Start workout" create action, warmup flag persisted to the DB.
- Audit score before fixes 14/20 (Good). Fixed in one batch: weight/reps tap area 26px -> 44px (pseudo-element hit area, optional `className` on `EditableStat`); decimal shown with a comma because "102.5" read as "1025" in the marker face (optional `format`, new `5ch` width); done sets stay editable instead of dimmed; visible disabled state and a visible idle check (it used `text-foreground`, invisible on the cream card); column headers Peso/Reps; empty-state hint contrast. Detector reported no findings. Known leftovers: delete-set button is 36px wide (kept to fit the row at 390px; above the 24px WCAG 2.2 AA minimum), the picker duplicates the one inside `ExerciseRow`, `PRODUCT.md` still describes the unthemed shadcn UI and there is no `DESIGN.md`.
