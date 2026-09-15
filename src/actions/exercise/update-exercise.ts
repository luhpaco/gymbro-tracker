"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
	updateExerciseSchema,
	UpdateExerciseInput,
} from "@/lib/schemas/exercise";
import { Exercise } from "@prisma/client";
import { deriveExerciseTag, normalizeExerciseName } from "@/lib/exercise-name";
import {
	findOwnedExerciseByCanonicalName,
	findOwnedExerciseById,
	isCanonicalUniquenessViolation,
} from "@/lib/exercises";

type ErrorCode =
	| "unauthorized"
	| "invalid_input"
	| "not_found"
	| "unknown_muscle_group"
	| "duplicate_name"
	| "error";

type UpdateExerciseResult =
	{ ok: true; exercise: Exercise } | { ok: false; code: ErrorCode };

const isRecordNotFound = (err: unknown): boolean => {
	if (typeof err !== "object" || err === null) return false;
	return "code" in err && err.code === "P2025";
};

export const updateExercise = async (
	input: UpdateExerciseInput,
): Promise<UpdateExerciseResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = updateExerciseSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const { description, id, muscleGroupTag, name: rawName } = parsed.data;
		const userId = session.user.id;
		const { canonicalName, name } = normalizeExerciseName(rawName);

		const target = await findOwnedExerciseById(prisma, { id, userId });
		if (!target) {
			return { ok: false, code: "not_found" };
		}

		const muscleGroup = await prisma.muscleGroup.findUnique({
			where: { tag: muscleGroupTag },
		});
		if (!muscleGroup) {
			return { ok: false, code: "unknown_muscle_group" };
		}

		const conflicting = await findOwnedExerciseByCanonicalName(prisma, {
			canonicalName,
			excludeId: id,
			userId,
		});
		if (conflicting) {
			return { ok: false, code: "duplicate_name" };
		}

		const exercise = await prisma.exercise.update({
			data: {
				canonicalName,
				description,
				muscleGroupTag,
				name,
				tag: deriveExerciseTag(name),
			},
			where: { id },
		});
		revalidatePath("/exercises");
		return { ok: true, exercise };
	} catch (err) {
		if (isRecordNotFound(err)) {
			return { ok: false, code: "not_found" };
		}
		if (isCanonicalUniquenessViolation(err)) {
			return { ok: false, code: "duplicate_name" };
		}
		return { ok: false, code: "error" };
	}
};
