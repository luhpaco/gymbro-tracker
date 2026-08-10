"use server";

import { auth } from "@/auth";
import { CreateExerciseFormData } from "@/components/exercise/CreateExerciseForm";
import prisma from "@/lib/prisma";

export const createExercise = async (formData: CreateExerciseFormData) => {
	try {
		const session = await auth();
		if (!session?.user) {
			throw new Error("No hay una sesión activa");
		}
		const newExercise = await prisma.exercise.create({
			data: {
				userId: session.user.id,
				name: formData.exerciseName,
				tag: formData.exerciseName.toLowerCase().replace(/\s/g, "-"),
				description: formData.description,
				muscleGroupTag: formData.muscleGroup,
			},
		});
		return newExercise;
	} catch (error) {
		console.error(error);
	}
};
