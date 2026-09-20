import { z } from "zod";
import { setSchema } from "./workout-set";

export { setSchema };

export const setsSchema = z
	.array(setSchema)
	.min(1, { message: "Debes agregar al menos un set" });

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
export type Exercise = z.infer<typeof AddExerciseFormSchema>;
