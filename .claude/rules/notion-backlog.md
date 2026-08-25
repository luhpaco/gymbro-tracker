# Notion backlog — gymbro-tracker

- **Source of truth for tasks**: Gymbro Tracker — Backlog (`https://app.notion.com/p/aff05be5327d4b68b2e9969339c94fac`).
- **Schema**: `Tarea` (title) / `Status` (Sin empezar, En curso, Listo) / `Prioridad` (Alta, Media, Baja) / `Tipo` (Feature, Bug, Housekeeping, Decisión) / `Owner` (Claude, OpenCode, Sin asignar) / `Fase / Referencia` (text) / `Notas` (text).
- **MCP**: hosted at `https://mcp.notion.com/mcp` (OAuth). No token lives in this repo or in `opencode.json`. Do not add one — the previous local-stdio + wrapper pattern was deleted on 2026-07-22; do not reintroduce it.
- **Sync with SDD**: when a Notion task starts, change `Status` to `En curso` and `Owner` to whoever is executing. When done, `Listo`. The `Fase / Referencia` column is the link to the SDD change folder (e.g., `openspec/changes/exercise-delete-state/`).
