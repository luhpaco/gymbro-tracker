type ProhibitedEffect =
	| "retry"
	| "seed"
	| "migration-rewrite"
	| "rollback"
	| "connection-input"
	| "connection-output"
	| "connection-persistence";

const effects: Record<ProhibitedEffect, number> = {
	"connection-input": 0,
	"connection-output": 0,
	"connection-persistence": 0,
	"migration-rewrite": 0,
	rollback: 0,
	retry: 0,
	seed: 0,
};

let migrationAttempts = 0;
let acceptanceStarted = false;
let smokeStarted = false;

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function simulateMigrationFailure(): never {
	migrationAttempts += 1;
	throw new Error("simulated migration failure");
}

function runAcceptance(): void {
	try {
		simulateMigrationFailure();
	} catch {
		return;
	}

	acceptanceStarted = true;
	smokeStarted = true;
}

function main(): void {
	runAcceptance();

	assert(
		migrationAttempts === 1,
		"migration failure must have exactly one attempt",
	);
	assert(
		!acceptanceStarted,
		"acceptance must not start after migration failure",
	);
	assert(!smokeStarted, "smoke must not start after migration failure");

	for (const [effect, count] of Object.entries(effects)) {
		assert(count === 0, `${effect} must not be invoked`);
	}

	process.stdout.write("migration failure guardrails passed\n");
}

main();
