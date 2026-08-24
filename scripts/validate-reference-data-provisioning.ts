import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const canonicalMuscleGroups = [
	["chest", "Pecho"],
	["back", "Espalda"],
	["shoulders", "Hombros"],
	["biceps", "Bíceps"],
	["triceps", "Tríceps"],
	["legs", "Piernas"],
	["glutes", "Glúteos"],
	["abs", "Abdominales"],
	["trapezius", "Trapecio"],
	["forearm", "Antebrazo"],
	["calves", "Gemelos"],
	["hamstrings", "Isquiotibiales"],
	["quadriceps", "Cuádriceps"],
	["deltoids", "Deltoides"],
] as const;

const root = process.cwd();
const migrationsDirectory = join(root, "prisma", "migrations");
const containerName = `reference-data-validation-${randomUUID()}`;

function runDocker(args: string[], input?: string): string {
	return execFileSync("docker", args, {
		encoding: "utf8",
		input,
		stdio: ["pipe", "pipe", "pipe"],
	});
}

async function runDockerAsync(args: string[], input?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout);
				return;
			}
			reject(new Error(stderr || "docker command failed"));
		});
		child.stdin.end(input);
	});
}

function sql(query: string): string {
	return runDocker(
		[
			"exec",
			"-i",
			containerName,
			"psql",
			"--set",
			"ON_ERROR_STOP=1",
			"--set",
			"VERBOSITY=verbose",
			"--username",
			"postgres",
			"--dbname",
			"postgres",
			"--quiet",
			"--tuples-only",
			"--no-align",
		],
		query,
	).trim();
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function migrationPath(): string {
	const matches = readdirSync(migrationsDirectory)
		.filter((entry) => entry.endsWith("_provision_muscle_groups"))
		.map((entry) => join(migrationsDirectory, entry, "migration.sql"))
		.filter(existsSync);

	assert(matches.length === 1, "expected exactly one provisioning migration");
	return matches[0];
}

function migrationSql(): string {
	const contents = readFileSync(migrationPath(), "utf8");

	for (const [tag, name] of canonicalMuscleGroups) {
		assert(
			contents.includes(`('${tag}', '${name}')`),
			`migration is missing canonical pair for ${tag}`,
		);
	}

	assert(
		!/seed|\/api\/seed|pnpm build/i.test(contents),
		"migration must not invoke seed or build behavior",
	);
	return contents;
}

function applyMigration(expectFailure = false): string {
	try {
		sql(migrationSql());
		assert(!expectFailure, "migration unexpectedly succeeded");
		return "success";
	} catch (error) {
		const message = errorText(error);
		assert(expectFailure, "migration unexpectedly failed");
		return message;
	}
}

function errorText(error: unknown): string {
	if (typeof error === "object" && error !== null && "stderr" in error) {
		const stderr = (error as { stderr?: string | Buffer }).stderr;
		if (typeof stderr === "string" && stderr) return stderr;
		if (Buffer.isBuffer(stderr) && stderr.length > 0)
			return stderr.toString("utf8");
	}

	return error instanceof Error ? error.message : "unknown failure";
}

function resetFixture(): void {
	sql(`
		DROP TABLE IF EXISTS "Set";
		DROP TABLE IF EXISTS "Workout";
		DROP TABLE IF EXISTS "Exercise";
		DROP TABLE IF EXISTS "User";
		DROP TABLE IF EXISTS "MuscleGroup";
		CREATE TABLE "MuscleGroup" (
			"id" SERIAL PRIMARY KEY,
			"name" TEXT NOT NULL UNIQUE,
			"tag" TEXT NOT NULL UNIQUE
		);
		CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE);
		CREATE TABLE "Workout" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id"));
		CREATE TABLE "Exercise" (
			"id" TEXT PRIMARY KEY,
			"muscleGroupTag" TEXT NOT NULL REFERENCES "MuscleGroup"("tag"),
			"userId" TEXT NOT NULL REFERENCES "User"("id")
		);
		CREATE TABLE "Set" (
			"id" TEXT PRIMARY KEY,
			"workoutId" TEXT NOT NULL REFERENCES "Workout"("id"),
			"exerciseId" TEXT NOT NULL REFERENCES "Exercise"("id")
		);
	`);
}

function canonicalRows(): string {
	return sql(`
		SELECT string_agg("tag" || ':' || "name", ',' ORDER BY "tag")
		FROM "MuscleGroup"
		WHERE "tag" IN (${canonicalMuscleGroups.map(([tag]) => `'${tag}'`).join(", ")});
	`);
}

function assertCanonicalState(): void {
	const rows = canonicalRows().split(",");
	assert(
		rows.length === canonicalMuscleGroups.length,
		"canonical row count must be fourteen",
	);

	for (const [tag, name] of canonicalMuscleGroups) {
		assert(
			rows.includes(`${tag}:${name}`),
			`canonical pair missing after provisioning: ${tag}`,
		);
	}
}

function snapshot(): string {
	return sql(`
		SELECT string_agg(record, '|' ORDER BY record)
		FROM (
			SELECT 'groups=' || count(*)::text AS record FROM "MuscleGroup"
			UNION ALL SELECT 'users=' || count(*)::text FROM "User"
			UNION ALL SELECT 'workouts=' || count(*)::text FROM "Workout"
			UNION ALL SELECT 'exercises=' || count(*)::text FROM "Exercise"
			UNION ALL SELECT 'sets=' || count(*)::text FROM "Set"
			UNION ALL SELECT 'chest=' || coalesce((SELECT "id"::text || ':' || "tag" || ':' || "name" FROM "MuscleGroup" WHERE "tag" = 'chest'), 'missing')
			UNION ALL SELECT 'exercise-muscle-group=' || coalesce((SELECT "muscleGroupTag" FROM "Exercise" WHERE "id" = 'exercise-1'), 'missing')
		) records;
	`);
}

function freshAndRetryCase(): void {
	resetFixture();
	applyMigration();
	assertCanonicalState();
	const beforeRetry = sql(
		'SELECT string_agg("id"::text || \':\' || "tag" || \':\' || "name", \',\' ORDER BY "tag") FROM "MuscleGroup";',
	);
	applyMigration();
	const afterRetry = sql(
		'SELECT string_agg("id"::text || \':\' || "tag" || \':\' || "name", \',\' ORDER BY "tag") FROM "MuscleGroup";',
	);
	assert(beforeRetry === afterRetry, "retry must not mutate canonical rows");
}

function upgradeAndDivergenceCase(): void {
	resetFixture();
	sql(`
		INSERT INTO "MuscleGroup" ("name", "tag") VALUES ('Legacy chest', 'chest'), ('Custom group', 'custom');
		INSERT INTO "User" ("id", "email") VALUES ('user-1', 'user@example.invalid');
		INSERT INTO "Workout" ("id", "userId") VALUES ('workout-1', 'user-1');
		INSERT INTO "Exercise" ("id", "muscleGroupTag", "userId") VALUES ('exercise-1', 'chest', 'user-1');
		INSERT INTO "Set" ("id", "workoutId", "exerciseId") VALUES ('set-1', 'workout-1', 'exercise-1');
	`);
	const chestId = sql(
		'SELECT "id"::text FROM "MuscleGroup" WHERE "tag" = \'chest\';',
	);
	applyMigration();
	assertCanonicalState();
	const after = snapshot();
	assert(after.includes("groups=15"), "extra muscle group must be preserved");
	assert(
		after.includes("users=1") &&
			after.includes("workouts=1") &&
			after.includes("exercises=1") &&
			after.includes("sets=1"),
		"user-owned rows and relationships must be preserved",
	);
	assert(
		after.includes(`chest=${chestId}:chest:Pecho`),
		"existing chest row must retain its identifier and tag while its name is reconciled",
	);
	assert(
		sql(
			'SELECT "muscleGroupTag" FROM "Exercise" WHERE "id" = \'exercise-1\';',
		) === "chest",
		"exercise foreign key must remain unchanged",
	);
}

function collisionCase(): void {
	resetFixture();
	sql(`
		INSERT INTO "MuscleGroup" ("name", "tag") VALUES ('Pecho', 'legacy-chest'), ('Legacy chest', 'chest');
	`);
	const before = snapshot();
	const failure = applyMigration(true);
	assert(
		failure.includes("P0001") &&
			failure.includes("reference_data_provisioning_incompatible_state"),
		"collision must return the static P0001 failure class",
	);
	assert(snapshot() === before, "collision must roll back without mutation");
}

async function concurrencyCases(): Promise<void> {
	resetFixture();
	await Promise.all([
		runDockerAsync(
			[
				"exec",
				"-i",
				containerName,
				"psql",
				"--set",
				"ON_ERROR_STOP=1",
				"--set",
				"VERBOSITY=verbose",
				"--username",
				"postgres",
				"--dbname",
				"postgres",
			],
			migrationSql(),
		),
		runDockerAsync(
			[
				"exec",
				"-i",
				containerName,
				"psql",
				"--set",
				"ON_ERROR_STOP=1",
				"--set",
				"VERBOSITY=verbose",
				"--username",
				"postgres",
				"--dbname",
				"postgres",
			],
			migrationSql(),
		),
	]);
	assertCanonicalState();

	resetFixture();
	sql(`
		INSERT INTO "MuscleGroup" ("name", "tag") VALUES ('Legacy chest', 'chest');
		INSERT INTO "User" ("id", "email") VALUES ('user-1', 'user@example.invalid');
		INSERT INTO "Exercise" ("id", "muscleGroupTag", "userId") VALUES ('exercise-1', 'chest', 'user-1');
	`);
	const before = snapshot();
	const blocker = runDockerAsync(
		[
			"exec",
			"-i",
			containerName,
			"psql",
			"--set",
			"ON_ERROR_STOP=1",
			"--set",
			"VERBOSITY=verbose",
			"--username",
			"postgres",
			"--dbname",
			"postgres",
		],
		'BEGIN; LOCK TABLE "MuscleGroup" IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(11); COMMIT;',
	);
	await new Promise((resolve) => setTimeout(resolve, 500));
	const failure = await runDockerAsync(
		[
			"exec",
			"-i",
			containerName,
			"psql",
			"--set",
			"ON_ERROR_STOP=1",
			"--set",
			"VERBOSITY=verbose",
			"--username",
			"postgres",
			"--dbname",
			"postgres",
		],
		migrationSql(),
	).then(
		() => "success",
		(error: unknown) => errorText(error),
	);
	await blocker;
	assert(
		failure.includes("lock timeout"),
		"competing writer must receive the bounded lock-timeout failure class",
	);
	assert(
		snapshot() === before,
		"competing writer timeout must leave rows unchanged",
	);
}

async function main(): Promise<void> {
	runDocker([
		"run",
		"--detach",
		"--rm",
		"--name",
		containerName,
		"--env",
		"POSTGRES_HOST_AUTH_METHOD=trust",
		"postgres:15.3",
	]);
	try {
		for (let attempt = 0; attempt < 30; attempt += 1) {
			try {
				runDocker([
					"exec",
					containerName,
					"pg_isready",
					"--username",
					"postgres",
				]);
				break;
			} catch {
				if (attempt === 29)
					throw new Error("disposable database did not become ready");
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}

		freshAndRetryCase();
		upgradeAndDivergenceCase();
		collisionCase();
		await concurrencyCases();
		process.stdout.write("reference-data provisioning validation passed\n");
	} finally {
		try {
			runDocker(["rm", "--force", containerName]);
		} catch {
			// The container is disposable and may already have been removed.
		}
	}
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : "validation failed";
	process.stderr.write(
		`reference-data provisioning validation failed: ${message}\n`,
	);
	process.exitCode = 1;
});
