"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
	createExerciseSchema,
	CreateExerciseInput,
} from "@/lib/schemas/exercise";
import prisma from "@/lib/prisma";
import { Exercise } from "@prisma/client";
import { deriveExerciseTag, normalizeExerciseName } from "@/lib/exercise-name";
import {
	findOwnedExerciseByCanonicalName,
	isCanonicalUniquenessViolation,
} from "@/lib/exercises";

type ErrorCode =
	| "unauthorized"
	| "invalid_input"
	| "unknown_muscle_group"
	| "duplicate_name"
	| "error";

type CreateExerciseResult =
	{ ok: true; exercise: Exercise } | { ok: false; code: ErrorCode };

export const createExercise = async (
	input: CreateExerciseInput,
): Promise<CreateExerciseResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = createExerciseSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const { description, muscleGroupTag, name: rawName } = parsed.data;
		const userId = session.user.id;
		const { canonicalName, name } = normalizeExerciseName(rawName);

		const muscleGroup = await prisma.muscleGroup.findUnique({
			where: { tag: muscleGroupTag },
		});
		if (!muscleGroup) {
			return { ok: false, code: "unknown_muscle_group" };
		}

		const existingExercise = await findOwnedExerciseByCanonicalName(prisma, {
			canonicalName,
			userId,
		});
		if (existingExercise) {
			return { ok: false, code: "duplicate_name" };
		}

		const exercise = await prisma.exercise.create({
			data: {
				canonicalName,
				description,
				muscleGroupTag,
				name,
				tag: deriveExerciseTag(name),
				userId,
			},
		});
		revalidatePath("/exercises");
		return { ok: true, exercise };
	} catch (err) {
		if (isCanonicalUniquenessViolation(err)) {
			return { ok: false, code: "duplicate_name" };
		}
		return { ok: false, code: "error" };
	}
};
