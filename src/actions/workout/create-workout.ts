"use server";

import { auth } from "@/auth";
import {
	AddWorkoutFormSchema,
	CreateWorkoutFormData,
} from "@/lib/schemas/workout";
import prisma from "@/lib/prisma";
import { buildSetsForCreate } from "@/lib/workout-sets";
import {
	MAX_TAG_ATTEMPTS,
	buildWorkoutTag,
	isWorkoutTagCollision,
	nextTagCandidate,
} from "@/lib/workout-tag";
import { Workout } from "@prisma/client";

type CreateWorkoutResult =
	| { ok: true; workout: Workout }
	| {
			ok: false;
			code: "unauthorized" | "invalid_input" | "duplicate_tag" | "error";
	  };

export const createWorkout = async (
	formData: CreateWorkoutFormData,
): Promise<CreateWorkoutResult> => {
	const session = await auth();
	if (!session?.user?.id) {
		return { ok: false, code: "unauthorized" };
	}

	const parsed = AddWorkoutFormSchema.safeParse(formData);
	if (!parsed.success) {
		return { ok: false, code: "invalid_input" };
	}

	try {
		const { listExercises, nameWorkout, dateWorkout } = parsed.data;
		const baseTag = buildWorkoutTag(nameWorkout, dateWorkout);
		const sets = buildSetsForCreate(listExercises);
		for (let attempt = 1; attempt <= MAX_TAG_ATTEMPTS; attempt++) {
			try {
				const workout = await prisma.workout.create({
					data: {
						userId: session.user.id,
						name: nameWorkout,
						date: dateWorkout,
						tag: nextTagCandidate(baseTag, attempt),
						sets: { create: sets },
					},
				});
				return { ok: true, workout };
			} catch (error) {
				if (!isWorkoutTagCollision(error)) throw error;
			}
		}
		return { ok: false, code: "duplicate_tag" };
	} catch (error) {
		console.error(error);
		return { ok: false, code: "error" };
	}
};
