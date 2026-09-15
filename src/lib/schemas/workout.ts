import { z } from "zod";

export const setSchema = z.object({
	reps: z.coerce.number().min(1, { message: "Debes agregar tus repeticiones" }),
	weight: z.coerce
		.number()
		.min(1, { message: "Debes agregar el peso de tus repeticiones" }),
});

export const setsSchema = z
	.array(setSchema)
	.min(1, { message: "Debes agregar al menos un set" })
	.max(5, { message: "Tómalo con calma!!" });

export const AddExerciseFormSchema = z.object({
	exerciseValue: z.string({
		required_error: "Por favor selecciona un ejercicio",
	}),
	exerciseName: z.string(),
	sets: setsSchema,
});

export const AddWorkoutFormSchema = z.object({
	nameWorkout: z
		.string()
		.min(1, { message: "Agrega un nombre a tu entrenamiento." }),
	dateWorkout: z.date({
		required_error: "Añade la fecha de tu entrenamiento",
	}),
	tagWorkout: z.string(),
	listExercises: z
		.array(AddExerciseFormSchema)
		.min(1, { message: "Agrega ejercicios a tu entrenamiento" }),
});

export type CreateWorkoutFormData = z.infer<typeof AddWorkoutFormSchema>;
