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

const COMPOSITE_TAG_INDEX = "Exercise_userId_tag_key";

const isCompositeTagViolation = (err: unknown): boolean => {
	if (typeof err !== "object" || err === null) {
		return false;
	}
	if (!("code" in err) || err.code !== "P2002") {
		return false;
	}
	const target =
		"meta" in err &&
		typeof err.meta === "object" &&
		err.meta !== null &&
		"target" in err.meta
			? err.meta.target
			: undefined;
	if (Array.isArray(target)) {
		return (
			target.length === 2 && target.includes("userId") && target.includes("tag")
		);
	}
	return target === COMPOSITE_TAG_INDEX;
};

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
	} catch (err) {
		if (isCompositeTagViolation(err)) {
			return { ok: false, code: "duplicate_tag" };
		}
		return { ok: false, code: "error" };
	}
};
