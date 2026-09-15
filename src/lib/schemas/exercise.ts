import { z } from "zod";

import { normalizeExerciseName } from "@/lib/exercise-name";

const NAME_MESSAGE =
	"El nombre de tu ejercicio debe tener por lo menos 4 caracteres";

const exerciseNameField = z.string().superRefine((value, ctx) => {
	const normalized = normalizeExerciseName(value).name;
	if (normalized.length < 4) {
		ctx.addIssue({
			code: z.ZodIssueCode.too_small,
			inclusive: true,
			message: NAME_MESSAGE,
			minimum: 4,
			type: "string",
		});
	}
});

export const createExerciseSchema = z
	.object({
		description: z.string().optional(),
		muscleGroupTag: z
			.string()
			.min(1, { message: "Selecciona un grupo muscular" }),
		name: exerciseNameField,
	})
	.strict();

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = z
	.object({
		description: z.string().optional(),
		id: z.string().min(1),
		muscleGroupTag: z
			.string()
			.min(1, { message: "Selecciona un grupo muscular" }),
		name: exerciseNameField,
	})
	.strict();

export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

export const exerciseActiveStateSchema = z.object({
	id: z.string().min(1),
	isActive: z.boolean(),
});

export type ExerciseActiveStateInput = z.infer<
	typeof exerciseActiveStateSchema
>;
