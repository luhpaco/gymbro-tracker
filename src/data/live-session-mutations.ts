import type { Workout } from "@prisma/client";

import prisma from "@/lib/prisma";
import type { ParsedFinishLiveSessionInput } from "@/lib/schemas/live-session";
import { buildSetsForCreate } from "@/lib/workout-sets";
import {
	MAX_TAG_ATTEMPTS,
	buildWorkoutTag,
	isWorkoutTagCollision,
	nextTagCandidate,
} from "@/lib/workout-tag";

type FinishLiveSessionDataResult =
	| { ok: true; created: true; workout: Workout }
	| { ok: true; created: false; workout: Workout }
	| {
			ok: false;
			code: "exercise_not_found" | "duplicate_tag" | "error";
	  };

const isWorkoutIdCollision = (error: unknown): boolean => {
	if (
		typeof error !== "object" ||
		error === null ||
		!("code" in error) ||
		error.code !== "P2002"
	) {
		return false;
	}

	const target =
		"meta" in error &&
		typeof error.meta === "object" &&
		error.meta !== null &&
		"target" in error.meta
			? error.meta.target
			: undefined;

	return (
		target === "id" ||
		(Array.isArray(target) && target.length === 1 && target[0] === "id")
	);
};

/** Saves a finished session atomically, with owner-scoped idempotency and server-owned set order. */
export const finishLiveSessionForUser = async (
	userId: string,
	input: ParsedFinishLiveSessionInput,
): Promise<FinishLiveSessionDataResult> => {
	const requestedExerciseIds = [
		...new Set(input.exercises.map((exercise) => exercise.exerciseId)),
	];
	const setRows = buildSetsForCreate(
		input.exercises.map((exercise) => ({
			exerciseValue: exercise.exerciseId,
			sets: exercise.sets,
		})),
	);
	const doneAtValues = input.exercises.flatMap((exercise) =>
		exercise.sets.map((set) => set.doneAt),
	);
	const sets = setRows.map((row, index) => ({
		...row,
		createdAt: doneAtValues[index],
	}));
	const baseTag = buildWorkoutTag(input.name, input.startedAt);

	for (let attempt = 1; attempt <= MAX_TAG_ATTEMPTS; attempt++) {
		try {
			const result = await prisma.$transaction(async (tx) => {
				const existing = await tx.workout.findUnique({
					where: { id: input.sessionId },
					include: { sets: true },
				});
				if (existing) {
					return existing.userId === userId
						? { ok: true as const, created: false as const, workout: existing }
						: { ok: false as const, code: "error" as const };
				}

				const ownedExercises = await tx.exercise.findMany({
					where: { userId, id: { in: requestedExerciseIds } },
					select: { id: true },
				});
				if (ownedExercises.length !== requestedExerciseIds.length) {
					return { ok: false as const, code: "exercise_not_found" as const };
				}

				const workout = await tx.workout.create({
					data: {
						id: input.sessionId,
						userId,
						name: input.name,
						date: input.startedAt,
						startedAt: input.startedAt,
						endedAt: input.endedAt,
						tag: nextTagCandidate(baseTag, attempt),
						sets: { create: sets },
					},
					include: { sets: true },
				});
				return { ok: true as const, created: true as const, workout };
			});
			if (!result.ok || !result.created) return result;
			return result;
		} catch (error) {
			if (isWorkoutIdCollision(error)) {
				try {
					const existing = await prisma.workout.findFirst({
						where: { id: input.sessionId, userId },
						include: { sets: true },
					});
					if (existing) return { ok: true, created: false, workout: existing };
					return { ok: false, code: "error" };
				} catch {
					return { ok: false, code: "error" };
				}
			}
			if (isWorkoutTagCollision(error)) continue;
			return { ok: false, code: "error" };
		}
	}

	return { ok: false, code: "duplicate_tag" };
};
