import { describe, expect, it } from "vitest";

import { normalizeExerciseName } from "./exercise-name";

describe("normalizeExerciseName", () => {
	it("trims surrounding whitespace for display and identity", () => {
		const result = normalizeExerciseName("  Press banca  ");

		expect(result.name).toBe("Press banca");
		expect(result.canonicalName).toBe(
			normalizeExerciseName("Press banca").canonicalName,
		);
	});

	it("collapses internal whitespace sequences to a single ASCII space", () => {
		const result = normalizeExerciseName("Press   banca\tcon\nbarra");

		expect(result.name).toBe("Press banca con barra");
		expect(result.canonicalName).toBe(
			normalizeExerciseName("Press banca con barra").canonicalName,
		);
	});

	it("treats non-breaking spaces as whitespace", () => {
		const result = normalizeExerciseName("Press banca");

		expect(result.name).toBe("Press banca");
		expect(result.canonicalName).toBe(
			normalizeExerciseName("Press banca").canonicalName,
		);
	});

	it("normalizes NFC so composed and decomposed inputs share identity", () => {
		const composed = "Café press";
		const decomposed = "Café press";

		expect(composed).not.toBe(decomposed);
		expect(normalizeExerciseName(composed).name).toBe(
			normalizeExerciseName(decomposed).name,
		);
		expect(normalizeExerciseName(composed).canonicalName).toBe(
			normalizeExerciseName(decomposed).canonicalName,
		);
	});

	it("is idempotent for display and canonical values", () => {
		const first = normalizeExerciseName("  Press   banca  ");
		const second = normalizeExerciseName(first.name);

		expect(second.name).toBe(first.name);
		expect(second.canonicalName).toBe(first.canonicalName);
	});

	it("folds case so equivalent spellings share canonical identity", () => {
		expect(normalizeExerciseName("Bench Press").canonicalName).toBe(
			normalizeExerciseName("  bench   PRESS  ").canonicalName,
		);
	});

	it("folds sharp-S to its expanded form", () => {
		expect(normalizeExerciseName("Straße press").canonicalName).toBe(
			normalizeExerciseName("STRASSE press").canonicalName,
		);
	});

	it("folds sigma variants to the same identity", () => {
		const upper = normalizeExerciseName("discos Σ press").canonicalName;
		const lower = normalizeExerciseName("discos σ press").canonicalName;
		const final = normalizeExerciseName("discos ς press").canonicalName;

		expect(lower).toBe(upper);
		expect(final).toBe(upper);
	});

	it("preserves accents in canonical identity", () => {
		expect(normalizeExerciseName("Café press").canonicalName).not.toBe(
			normalizeExerciseName("Cafe press").canonicalName,
		);
	});

	it("preserves hyphens versus spaces in canonical identity", () => {
		expect(normalizeExerciseName("Bench-Press").canonicalName).not.toBe(
			normalizeExerciseName("Bench Press").canonicalName,
		);
	});

	it("preserves display case while folding canonical identity", () => {
		const result = normalizeExerciseName("Press Banca");

		expect(result.name).toBe("Press Banca");
		expect(result.canonicalName).toBe(
			normalizeExerciseName("press banca").canonicalName,
		);
	});
});
