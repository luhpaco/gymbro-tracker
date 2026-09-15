import { normalizeExerciseName } from "./exercise-name";

export interface ExerciseNameRow {
	id: string;
	userId: string;
	name: string;
}

export interface CanonicalCollision {
	userId: string;
	canonicalName: string;
	ids: string[];
}

export interface BackfillPlanRow {
	id: string;
	name: string;
	canonicalName: string;
}

type BackfillPrisma = {
	exercise: {
		findMany: (args?: any) => Promise<
			Array<{
				id: string;
				name: string;
				canonicalName?: string | null;
				userId?: string;
			}>
		>;
		update: (args: any) => Promise<unknown>;
	};
};

export const findCanonicalCollisions = (
	rows: ExerciseNameRow[],
): CanonicalCollision[] => {
	const groups = new Map<
		string,
		{ userId: string; canonicalName: string; ids: string[] }
	>();

	for (const row of rows) {
		const { canonicalName } = normalizeExerciseName(row.name);
		const key = `${row.userId}::${canonicalName}`;
		const group = groups.get(key);
		if (group) {
			if (!group.ids.includes(row.id)) group.ids.push(row.id);
		} else {
			groups.set(key, { canonicalName, ids: [row.id], userId: row.userId });
		}
	}

	return [...groups.values()].filter((group) => group.ids.length > 1);
};

export const planExerciseNameBackfill = (
	rows: Array<{ id: string; name: string; userId?: string }>,
): BackfillPlanRow[] =>
	rows.map((row) => {
		const { canonicalName, name } = normalizeExerciseName(row.name);
		return { canonicalName, id: row.id, name };
	});

export const runExerciseNameBackfill = async (options: {
	prisma: BackfillPrisma;
	authorizedConnection?: boolean;
	allowWrite?: boolean;
	dryRun?: boolean;
}): Promise<
	| { ok: true; planned: number; updated: number }
	| { ok: false; code: string; collisions?: CanonicalCollision[] }
> => {
	const { allowWrite, authorizedConnection, dryRun = true, prisma } = options;

	if (!authorizedConnection || !allowWrite) {
		return { code: "refused", ok: false };
	}

	const rows = await prisma.exercise.findMany();
	const collisions = findCanonicalCollisions(
		rows.map((row) => ({
			id: row.id,
			name: row.name,
			userId: row.userId ?? row.id,
		})),
	);
	if (collisions.length > 0) {
		return { code: "collision", collisions, ok: false };
	}

	const plan = planExerciseNameBackfill(rows);
	const pending = plan.filter((row, index) => {
		const current = rows[index]?.canonicalName ?? null;
		return current !== row.canonicalName;
	});

	if (dryRun) {
		return { ok: true, planned: pending.length, updated: 0 };
	}

	for (const row of pending) {
		await prisma.exercise.update({
			data: { canonicalName: row.canonicalName, name: row.name },
			where: { id: row.id },
		});
	}

	return { ok: true, planned: pending.length, updated: pending.length };
};
