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

// Post-save metadata edit. Reuses the create-time name and date validators so
// the rules stay identical, but stays independent of creation's tag and
// exercise-list shape. The stored tag is never an input: it is immutable.
export const UpdateWorkoutFormSchema = z.object({
	workoutId: z
		.string()
		.uuid({ message: "El identificador del entrenamiento no es válido" }),
	nameWorkout: AddWorkoutFormSchema.shape.nameWorkout,
	dateWorkout: AddWorkoutFormSchema.shape.dateWorkout,
});

// Post-save mutation inputs. Each identifier is validated as a UUID string,
// because the schema generates UUID ids, so a malformed identifier is rejected
// before any database access. These shapes describe the accepted payload; they
// are not permission to skip runtime validation in the actions.
const WORKOUT_ID_MESSAGE = "El identificador del entrenamiento no es válido";
const EXERCISE_ID_MESSAGE = "El identificador del ejercicio no es válido";
const SET_ID_MESSAGE = "El identificador del set no es válido";

const workoutIdSchema = z.string().uuid({ message: WORKOUT_ID_MESSAGE });
const exerciseIdSchema = z.string().uuid({ message: EXERCISE_ID_MESSAGE });
const setIdSchema = z.string().uuid({ message: SET_ID_MESSAGE });

// Whole-workout deletion input. The action is only ever invoked after the
// explicit bottom-sheet confirmation; this shape carries no confirmation flag
// because confirmation is a UI gate, not a server contract.
export const DeleteWorkoutFormSchema = z.object({
	workoutId: workoutIdSchema,
});

// Post-save set addition. Reuses the shared `setsSchema`, so weight,
// repetitions and warmup follow the same rules as creation with no upper bound.
// Zod strips unknown keys (such as a client-supplied `order`), so ordering stays
// server-owned and is never persisted from client input.
export const AddSetsFormSchema = z.object({
	workoutId: workoutIdSchema,
	exerciseId: exerciseIdSchema,
	sets: setsSchema,
});

// Post-save single-set deletion, scoped by its owned workout.
export const DeleteSetFormSchema = z.object({
	workoutId: workoutIdSchema,
	setId: setIdSchema,
});

// Post-save exercise removal, scoped by its owned workout.
export const RemoveWorkoutExerciseFormSchema = z.object({
	workoutId: workoutIdSchema,
	exerciseId: exerciseIdSchema,
});

export type CreateWorkoutFormData = z.infer<typeof AddWorkoutFormSchema>;
export type Exercise = z.infer<typeof AddExerciseFormSchema>;
export type UpdateWorkoutInput = z.infer<typeof UpdateWorkoutFormSchema>;
export type DeleteWorkoutInput = z.infer<typeof DeleteWorkoutFormSchema>;
export type AddSetsInput = z.infer<typeof AddSetsFormSchema>;
export type DeleteSetInput = z.infer<typeof DeleteSetFormSchema>;
export type RemoveWorkoutExerciseInput = z.infer<
	typeof RemoveWorkoutExerciseFormSchema
>;
