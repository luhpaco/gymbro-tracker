import type { Prisma } from "@prisma/client";

export interface SetCreateRow {
	exerciseId: string;
	order: number;
	reps: number;
	weight: number;
	isWarmup: boolean;
}

interface ExerciseEntry {
	exerciseValue: string;
	sets: ReadonlyArray<{ reps: number; weight: number; isWarmup: boolean }>;
}

export interface SortableSet {
	id: string;
	order: number;
	createdAt: Date;
}

// Reads only the fields it needs so a client-supplied `order` can never be copied through.
export const buildSetsForCreate = (
	listExercises: readonly ExerciseEntry[],
): SetCreateRow[] =>
	listExercises
		.flatMap((exercise) =>
			exercise.sets.map((set) => ({
				exerciseId: exercise.exerciseValue,
				reps: set.reps,
				weight: set.weight,
				isWarmup: set.isWarmup,
			})),
		)
		.map((row, order) => ({ ...row, order }));

const compareSets = (a: SortableSet, b: SortableSet): number =>
	a.order - b.order ||
	a.createdAt.getTime() - b.createdAt.getTime() ||
	(a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const sortSets = <T extends SortableSet>(sets: readonly T[]): T[] =>
	[...sets].sort(compareSets);

export const groupSetsByExercise = <
	T extends SortableSet & { exercise: { name: string } },
>(
	sets: readonly T[],
): Record<string, T[]> => {
	const grouped: Record<string, T[]> = {};
	for (const set of sortSets(sets)) {
		(grouped[set.exercise.name] ??= []).push(set);
	}
	return grouped;
};

// Must stay in sync with `compareSets`; the JS sort stays authoritative because the DB may collate ids differently.
export const SET_ORDER_BY: Prisma.SetOrderByWithRelationInput[] = [
	{ order: "asc" },
	{ createdAt: "asc" },
	{ id: "asc" },
];
