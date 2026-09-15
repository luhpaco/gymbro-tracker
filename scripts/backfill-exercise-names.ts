import prisma from "../src/lib/prisma";
import { runExerciseNameBackfill } from "../src/lib/exercise-name-backfill";

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

async function main(): Promise<void> {
	const authorizedConnection = hasFlag("--authorized-connection");
	const allowWrite = hasFlag("--allow-write");
	const dryRun = !hasFlag("--execute");

	if (!authorizedConnection || !allowWrite) {
		console.log(
			"Refusing backfill without explicit authorized connection and write opt-in.",
		);
		console.log(
			"Re-run with --authorized-connection --allow-write [--execute]; without --execute this is a dry run with zero writes.",
		);
		process.exitCode = 1;
		return;
	}

	const result = await runExerciseNameBackfill({
		allowWrite,
		authorizedConnection,
		dryRun,
		prisma,
	});

	if (!result.ok) {
		console.log(`Backfill blocked: ${result.code}`);
		if (result.collisions) {
			for (const collision of result.collisions) {
				console.log(
					`Owner ${collision.userId} collides on "${collision.canonicalName}": ${collision.ids.join(", ")}`,
				);
			}
		}
		process.exitCode = 1;
		return;
	}

	console.log(
		`Backfill ${dryRun ? "dry run" : "completed"}: ${result.planned} planned, ${result.updated} updated.`,
	);
}

void main()
	.catch((error) => {
		console.error("Backfill failed.");
		if (error instanceof Error) console.error(error.message);
		process.exitCode = 1;
	})
	.finally(() => void prisma.$disconnect());
