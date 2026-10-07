import { describe, expect, it } from "vitest";

import {
	DELETE_FAILURE_MESSAGES,
	DELETE_WORKOUT_SUCCESS_HREF,
	beginDeleteRequest,
	failDeleteRequest,
	getDeleteFailureMessage,
	initialDeleteSheetState,
	resolveDeleteIntent,
	type DeleteFailureCode,
	type DeleteIntent,
} from "./workout-delete-confirmation.logic";

const DISMISSAL_INTENTS: DeleteIntent[] = [
	"overlay",
	"escape",
	"close-icon",
	"cancel",
];

describe("workout-delete-confirmation.logic", () => {
	describe("DELETE_WORKOUT_SUCCESS_HREF", () => {
		it("sends the user back to the workout list after a committed delete", () => {
			expect(DELETE_WORKOUT_SUCCESS_HREF).toBe("/workouts");
		});
	});

	describe("getDeleteFailureMessage", () => {
		it.each<[DeleteFailureCode, string]>([
			["unauthorized", "Tu sesión expiró. Vuelve a iniciar sesión."],
			["invalid_input", "Revisa los datos e inténtalo de nuevo."],
			["not_found", "El entrenamiento no existe o no te pertenece."],
			["error", "No pudimos eliminar el entrenamiento. Inténtalo de nuevo."],
		])(
			"maps %s to an explanation the sheet can show in context",
			(code, expected) => {
				expect(getDeleteFailureMessage(code)).toBe(expected);
				expect(DELETE_FAILURE_MESSAGES[code]).toBe(expected);
			},
		);
	});

	describe("delete sheet state", () => {
		it("starts idle with no failure shown", () => {
			expect(initialDeleteSheetState).toEqual({
				isPending: false,
				failure: null,
			});
		});

		it("locks the sheet and clears any previous failure when a request begins", () => {
			const started = beginDeleteRequest();

			expect(started).toEqual({ isPending: true, failure: null });
		});

		it("unlocks the sheet and keeps the coded failure when the request fails", () => {
			const failed = failDeleteRequest("not_found");

			expect(failed).toEqual({ isPending: false, failure: "not_found" });
		});
	});

	describe("resolveDeleteIntent", () => {
		it("only the explicit confirmation can resolve to a delete", () => {
			expect(resolveDeleteIntent("confirm", false)).toBe("delete");
		});

		it("opening the sheet never deletes or dismisses anything", () => {
			expect(resolveDeleteIntent("open", false)).toBe("open");
			expect(resolveDeleteIntent("open", true)).toBe("open");
		});

		it.each(DISMISSAL_INTENTS)(
			"dismissing through %s keeps the workout untouched",
			(intent) => {
				expect(resolveDeleteIntent(intent, false)).toBe("dismiss");
			},
		);

		it.each(DISMISSAL_INTENTS)(
			"dismissing through %s is ignored while the delete is pending",
			(intent) => {
				expect(resolveDeleteIntent(intent, true)).toBe("noop");
			},
		);

		it("refuses a repeated confirmation while the delete is pending", () => {
			expect(resolveDeleteIntent("confirm", true)).toBe("noop");
		});

		it("never resolves a dismissal path to a delete", () => {
			for (const intent of DISMISSAL_INTENTS) {
				expect(resolveDeleteIntent(intent, false)).not.toBe("delete");
				expect(resolveDeleteIntent(intent, true)).not.toBe("delete");
			}
		});
	});
});
