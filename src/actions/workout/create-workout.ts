"use server";

import { auth } from "@/auth";
import {
	AddWorkoutFormSchema,
	CreateWorkoutFormData,
} from "@/lib/schemas/workout";
import prisma from "@/lib/prisma";
import { buildSetsForCreate } from "@/lib/workout-sets";
import { Workout } from "@prisma/client";

type CreateWorkoutResult =
	| { ok: true; workout: Workout }
	| { ok: false; code: "unauthorized" | "invalid_input" | "error" };

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
		const workout = await prisma.workout.create({
			data: {
				userId: session.user.id,
				name: nameWorkout,
				date: dateWorkout,
				tag:
					nameWorkout.toLowerCase().replace(/\s/g, "-") +
					"-workout-" +
					dateWorkout.toISOString(),
				sets: {
					create: buildSetsForCreate(listExercises),
				},
			},
		});
		return { ok: true, workout };
	} catch (error) {
		console.error(error);
		return { ok: false, code: "error" };
	}
};
