"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
	exerciseActiveStateSchema,
	ExerciseActiveStateInput,
} from "@/lib/schemas/exercise";
import prisma from "@/lib/prisma";
import { Exercise } from "@prisma/client";

type ErrorCode = "unauthorized" | "invalid_input" | "not_found" | "error";

type SetExerciseActiveStateResult =
	{ ok: true; exercise: Exercise } | { ok: false; code: ErrorCode };

export const setExerciseActiveState = async (
	input: ExerciseActiveStateInput,
): Promise<SetExerciseActiveStateResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = exerciseActiveStateSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const { id, isActive } = parsed.data;
		const userId = session.user.id;

		const target = await prisma.exercise.findFirst({
			where: { id, userId },
		});
		if (!target) {
			return { ok: false, code: "not_found" };
		}

		const exercise = await prisma.exercise.update({
			data: { isActive },
			where: { id: target.id },
		});
		revalidatePath("/exercises");
		return { ok: true, exercise };
	} catch {
		return { ok: false, code: "error" };
	}
};
