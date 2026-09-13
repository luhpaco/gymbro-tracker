"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
	createExerciseSchema,
	CreateExerciseInput,
} from "@/lib/schemas/exercise";
import prisma from "@/lib/prisma";
import { Exercise } from "@prisma/client";

type ErrorCode =
	| "unauthorized"
	| "invalid_input"
	| "unknown_muscle_group"
	| "duplicate_tag"
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

		const { name, description, muscleGroupTag } = parsed.data;
		const userId = session.user.id;

		const muscleGroup = await prisma.muscleGroup.findUnique({
			where: { tag: muscleGroupTag },
		});
		if (!muscleGroup) {
			return { ok: false, code: "unknown_muscle_group" };
		}

		const tag = name.toLowerCase().replace(/\s/g, "-");

		const existingExercise = await prisma.exercise.findFirst({
			where: { userId, tag },
		});
		if (existingExercise) {
			return { ok: false, code: "duplicate_tag" };
		}

		const exercise = await prisma.exercise.create({
			data: {
				userId,
				name,
				tag,
				description,
				muscleGroupTag,
			},
		});
		revalidatePath("/exercises");
		return { ok: true, exercise };
	} catch {
		return { ok: false, code: "error" };
	}
};
