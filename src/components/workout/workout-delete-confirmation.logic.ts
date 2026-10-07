export const DELETE_WORKOUT_SUCCESS_HREF = "/workouts";

export type DeleteFailureCode =
	"not_found" | "unauthorized" | "invalid_input" | "error";

export const DELETE_FAILURE_MESSAGES: Record<DeleteFailureCode, string> = {
	not_found: "El entrenamiento no existe o no te pertenece.",
	unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
	invalid_input: "Revisa los datos e inténtalo de nuevo.",
	error: "No pudimos eliminar el entrenamiento. Inténtalo de nuevo.",
};

export const getDeleteFailureMessage = (code: DeleteFailureCode): string =>
	DELETE_FAILURE_MESSAGES[code];

export interface DeleteSheetState {
	isPending: boolean;
	failure: DeleteFailureCode | null;
}

export const initialDeleteSheetState: DeleteSheetState = {
	isPending: false,
	failure: null,
};

export const beginDeleteRequest = (): DeleteSheetState => ({
	isPending: true,
	failure: null,
});

export const failDeleteRequest = (
	code: DeleteFailureCode,
): DeleteSheetState => ({
	isPending: false,
	failure: code,
});

/**
 * Every way the sheet can be engaged. Only `confirm` may lead to a delete;
 * opening and each dismissal path are kept separate so the contract is explicit
 * and testable without a DOM.
 */
export type DeleteIntent =
	"open" | "overlay" | "escape" | "close-icon" | "cancel" | "confirm";

export type DeleteIntentOutcome = "open" | "dismiss" | "delete" | "noop";

export const resolveDeleteIntent = (
	intent: DeleteIntent,
	isPending: boolean,
): DeleteIntentOutcome => {
	if (intent === "confirm") {
		// A repeat confirmation while the request is in flight is ignored.
		return isPending ? "noop" : "delete";
	}

	if (intent === "open") {
		return "open";
	}

	// Overlay, Escape, close icon and Cancel may only dismiss, and are ignored
	// entirely while the request is pending so context cannot be lost.
	return isPending ? "noop" : "dismiss";
};
