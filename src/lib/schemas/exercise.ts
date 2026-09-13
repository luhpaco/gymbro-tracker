import { z } from "zod";

export const createExerciseSchema = z.object({
	name: z.string().trim().min(4, {
		message: "El nombre de tu ejercicio debe tener por lo menos 4 caracteres",
	}),
	description: z.string().optional(),
	muscleGroupTag: z
		.string()
		.min(1, { message: "Selecciona un grupo muscular" }),
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const exerciseActiveStateSchema = z.object({
	id: z.string().min(1),
	isActive: z.boolean(),
});

export type ExerciseActiveStateInput = z.infer<
	typeof exerciseActiveStateSchema
>;
