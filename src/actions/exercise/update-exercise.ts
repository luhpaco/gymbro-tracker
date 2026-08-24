"use server";

import { UpdateExerciseFormData } from "@/components/exercise/UpdateExerciseForm";
import prisma from "@/lib/prisma";

export const updateExercise = async (
	exerciseId: string,
	userId: string,
	data: UpdateExerciseFormData,
) => {
	try {
		const updatedExercise = await prisma.exercise.update({
			where: {
				id: exerciseId,
				userId: userId,
			},
			data: {
				name: data.exerciseName,
				description: data.description,
				muscleGroupTag: data.muscleGroup,
			},
		});
		return {
			ok: true,
			message: "Ejercicio actualizado satisfactoriamente",
		};
	} catch (error) {
		console.log(error);
		return {
			ok: false,
			message: "No se pudo actualizar el ejercicio",
		};
	}
};
