import { describe, expect, it } from "vitest";

import {
	buildAddSetPayload,
	formatDateForInput,
	getMutationMessage,
	isPending,
	parseDateInput,
	validateAddSetDraft,
	type PendingConfirmation,
} from "./workout-detail-controls.logic";

describe("workout-detail-controls.logic", () => {
	describe("getMutationMessage", () => {
		it.each<
			[
				(
					| "unauthorized"
					| "invalid_input"
					| "not_found"
					| "last_set"
					| "last_exercise"
					| "error"
				),
				string,
			]
		>([
			["unauthorized", "Tu sesión expiró. Vuelve a iniciar sesión."],
			["invalid_input", "Revisa los datos e inténtalo de nuevo."],
			["not_found", "El elemento no existe o no te pertenece."],
			[
				"last_set",
				"No puedes eliminar la última serie de este ejercicio. Agrega otra serie primero.",
			],
			[
				"last_exercise",
				"No puedes eliminar el último ejercicio del entrenamiento. Si quieres borrarlo, elimina el entrenamiento completo.",
			],
			["error", "Ups, ocurrió un problema. Inténtalo de nuevo."],
		])("maps %s to its user-facing explanation", (code, expected) => {
			expect(getMutationMessage(code)).toBe(expected);
		});
	});

	describe("formatDateForInput", () => {
		it("formats an ISO date string as YYYY-MM-DD", () => {
			expect(formatDateForInput("2026-01-15T00:00:00.000Z")).toBe("2026-01-15");
		});

		it("returns an empty string for an unparseable date", () => {
			expect(formatDateForInput("not-a-date")).toBe("");
		});
	});

	describe("parseDateInput", () => {
		it("parses a YYYY-MM-DD value into a Date", () => {
			const result = parseDateInput("2026-01-15");
			expect(result).toBeInstanceOf(Date);
			expect(result?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
		});

		it("returns null for an empty value", () => {
			expect(parseDateInput("")).toBeNull();
		});

		it("returns null for an invalid value", () => {
			expect(parseDateInput("2026-13-01")).toBeNull();
		});
	});

	describe("validateAddSetDraft", () => {
		it("returns parsed numbers for a valid draft", () => {
			expect(validateAddSetDraft({ weight: "62.5", reps: "8" })).toEqual({
				weight: 62.5,
				reps: 8,
			});
		});

		it("rejects a blank weight", () => {
			expect(validateAddSetDraft({ weight: "", reps: "8" })).toBeNull();
		});

		it("rejects a non-numeric weight", () => {
			expect(validateAddSetDraft({ weight: "heavy", reps: "8" })).toBeNull();
		});

		it("rejects a negative weight", () => {
			expect(validateAddSetDraft({ weight: "-1", reps: "8" })).toBeNull();
		});

		it("accepts a zero weight", () => {
			expect(validateAddSetDraft({ weight: "0", reps: "8" })).toEqual({
				weight: 0,
				reps: 8,
			});
		});

		it("rejects blank reps", () => {
			expect(validateAddSetDraft({ weight: "60", reps: "" })).toBeNull();
		});

		it("rejects non-integer reps", () => {
			expect(validateAddSetDraft({ weight: "60", reps: "8.5" })).toBeNull();
		});

		it("rejects zero reps", () => {
			expect(validateAddSetDraft({ weight: "60", reps: "0" })).toBeNull();
		});
	});

	describe("buildAddSetPayload", () => {
		it("builds a single-set payload for the action", () => {
			expect(
				buildAddSetPayload("workout-1", "exercise-1", {
					weight: 60,
					reps: 8,
					isWarmup: true,
				}),
			).toEqual({
				workoutId: "workout-1",
				exerciseId: "exercise-1",
				sets: [{ weight: 60, reps: 8, isWarmup: true }],
			});
		});
	});

	describe("isPending", () => {
		it("returns true when kind and id both match", () => {
			const pending: PendingConfirmation = { kind: "set", id: "set-1" };
			expect(isPending(pending, "set", "set-1")).toBe(true);
		});

		it("returns false when the kind differs", () => {
			const pending: PendingConfirmation = { kind: "set", id: "set-1" };
			expect(isPending(pending, "exercise", "set-1")).toBe(false);
		});

		it("returns false when the id differs", () => {
			const pending: PendingConfirmation = { kind: "set", id: "set-1" };
			expect(isPending(pending, "set", "set-2")).toBe(false);
		});

		it("returns false when no confirmation is pending", () => {
			expect(isPending(null, "set", "set-1")).toBe(false);
		});
	});
});
