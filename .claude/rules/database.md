# Database (Prisma) — gymbro-tracker

- **Schema**: `prisma/schema.prisma`. Connection via `POSTGRES_URL` in `.env` (gitignored; use `.env.template` as reference).
- **Models** (current): `User`, `MuscleGroup`, `Exercise`, `Workout`, `Set`. Enums: `Role`.

## Workflow for schema changes

1. Edit `prisma/schema.prisma`.
2. `pnpm exec prisma migrate dev --name <descriptive-name>` — generates and applies a migration.
3. Verify `prisma/migrations/<timestamp>_<name>/migration.sql` reads correctly.
4. The Prisma client auto-regenerates. If not, `pnpm exec prisma generate`.
5. Run the dev DB locally: `docker compose up -d`.
6. Commit the schema change AND the migration folder together.

## Hard rules

- **Never edit generated migration files manually** — they will be reapplied incorrectly on the next `migrate dev`. Roll forward with a new migration instead.
- **Never commit `.env`** — it contains `POSTGRES_URL` and `AUTH_SECRET`. `.env.template` is the safe template.
- **Prisma queries stay in `src/lib/` or `src/data/`** — not in components. Components consume the data layer; they do not query directly.
- **Server actions live in `src/actions/<feature>.ts`** and always validate input with Zod before touching the DB.
