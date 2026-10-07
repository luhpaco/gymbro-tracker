import { setSchema } from "@/lib/schemas/workout-set";

export type MutationCode =
	| "unauthorized"
	| "invalid_input"
	| "not_found"
	| "last_set"
	| "last_exercise"
	| "error";

export const MUTATION_MESSAGES: Record<MutationCode, string> = {
	unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
	invalid_input: "Revisa los datos e inténtalo de nuevo.",
	not_found: "El elemento no existe o no te pertenece.",
	last_set:
		"No puedes eliminar la última serie de este ejercicio. Agrega otra serie primero.",
	last_exercise:
		"No puedes eliminar el último ejercicio del entrenamiento. Si quieres borrarlo, elimina el entrenamiento completo.",
	error: "Ups, ocurrió un problema. Inténtalo de nuevo.",
};

export const getMutationMessage = (code: MutationCode): string =>
	MUTATION_MESSAGES[code];

export type PendingConfirmation =
	{ kind: "set"; id: string } | { kind: "exercise"; id: string } | null;

export const isPending = (
	pending: PendingConfirmation,
	kind: "set" | "exercise",
	id: string,
): boolean => pending?.kind === kind && pending.id === id;

export interface ExerciseSetGroup<TSet> {
	exerciseName: string;
	exerciseId: string;
	sets: TSet[];
}

/**
 * Builds the exercise groups the detail controls mutate.
 *
 * Mutation identity is the recorded exercise id carried by the group's first
 * set (`sets[0].exerciseId`), never the display name: the name is only a label,
 * and the stored id is what the owner-scoped actions must receive. A group
 * always has at least one set by the saved-workout invariant, so the first set
 * is present; the empty guard only keeps the helper total.
 */
export const buildExerciseGroups = <TSet extends { exerciseId: string }>(
	setsByExercise: Record<string, TSet[]>,
): ExerciseSetGroup<TSet>[] =>
	Object.entries(setsByExercise).map(([exerciseName, sets]) => ({
		exerciseName,
		exerciseId: sets[0]?.exerciseId ?? "",
		sets,
	}));

export const formatDateForInput = (isoDate: string): string => {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().split("T")[0];
};

export const parseDateInput = (value: string): Date | null => {
	if (value.trim() === "") return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
};

interface AddSetDraft {
	weight: string;
	reps: string;
}

interface AddSetValues {
	weight: number;
	reps: number;
}

export const validateAddSetDraft = (
	draft: AddSetDraft,
): AddSetValues | null => {
	if (draft.weight.trim() === "" || draft.reps.trim() === "") return null;
	const weight = setSchema.shape.weight.safeParse(Number(draft.weight));
	const reps = setSchema.shape.reps.safeParse(Number(draft.reps));
	if (!weight.success || !reps.success) return null;
	return { weight: weight.data, reps: reps.data };
};

interface AddSetPayloadValues {
	weight: number;
	reps: number;
	isWarmup: boolean;
}

export const buildAddSetPayload = (
	workoutId: string,
	exerciseId: string,
	values: AddSetPayloadValues,
) => ({
	workoutId,
	exerciseId,
	sets: [
		{
			weight: values.weight,
			reps: values.reps,
			isWarmup: values.isWarmup,
		},
	],
});
