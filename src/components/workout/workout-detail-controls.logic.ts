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
	const weight = Number(draft.weight);
	if (
		draft.weight.trim() === "" ||
		Number.isNaN(weight) ||
		!Number.isFinite(weight) ||
		weight < 0
	) {
		return null;
	}

	const reps = Number(draft.reps);
	if (
		draft.reps.trim() === "" ||
		Number.isNaN(reps) ||
		!Number.isInteger(reps) ||
		reps < 1
	) {
		return null;
	}

	return { weight, reps };
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
