import { describe, it, expect } from "vitest";
import {
	buildDecodedFallbackTrail,
	getStaticTrail,
	isGuardedPath,
	normalizePathname,
} from "./breadcrumb-trails";

describe("sibling navigation: static trails stay fresh per pathname", () => {
	it("returns the correct static trail for /workouts/create", () => {
		expect(getStaticTrail("/workouts/create")!.map((b) => b.label)).toEqual([
			"Dashboard",
			"Mis entrenamientos",
			"Crear entrenamiento",
		]);
	});

	it("switching from /exercises/create to /workouts/create changes the trail", () => {
		const from = getStaticTrail("/exercises/create")!.map((b) => b.label);
		const to = getStaticTrail("/workouts/create")!.map((b) => b.label);
		expect(from).toEqual(["Dashboard", "Mis ejercicios", "Crear ejercicio"]);
		expect(to).toEqual([
			"Dashboard",
			"Mis entrenamientos",
			"Crear entrenamiento",
		]);
		expect(to).not.toEqual(from);
	});

	it("normalizes trailing slashes so sibling comparison is stable", () => {
		expect(normalizePathname("/workouts/create/")).toBe("/workouts/create");
		expect(getStaticTrail("/workouts/create/")).toEqual(
			getStaticTrail("/workouts/create"),
		);
	});
});

describe("dynamic fallback never leaks the previous route's trail", () => {
	it("builds a same-route decoded fallback for /workouts/<slug>", () => {
		const trail = buildDecodedFallbackTrail("/workouts/mi-rutina");
		expect(trail!.map((b) => b.label)).toEqual([
			"Dashboard",
			"Mis entrenamientos",
			"mi rutina",
		]);
	});

	it("builds a same-route decoded fallback for /exercises/update/<id>", () => {
		const trail = buildDecodedFallbackTrail("/exercises/update/abc-123");
		expect(trail!.map((b) => b.label)).toEqual([
			"Dashboard",
			"Mis ejercicios",
			"abc 123",
		]);
	});

	it("returns null for unknown routes (renders nothing)", () => {
		expect(buildDecodedFallbackTrail("/unknown/path")).toBeNull();
	});

	it("rejects nested paths under /exercises/update (exact 3-segment match)", () => {
		expect(buildDecodedFallbackTrail("/exercises/update/a/b")).toBeNull();
	});

	it("rejects nested paths under /workouts (exact 2-segment match)", () => {
		expect(buildDecodedFallbackTrail("/workouts/a/b")).toBeNull();
	});

	it("keeps resolving valid dynamic routes after exact-match guard", () => {
		expect(
			buildDecodedFallbackTrail("/workouts/mi-rutina")!.map((b) => b.label),
		).toEqual(["Dashboard", "Mis entrenamientos", "mi rutina"]);
		expect(
			buildDecodedFallbackTrail("/exercises/update/abc-123")!.map(
				(b) => b.label,
			),
		).toEqual(["Dashboard", "Mis ejercicios", "abc 123"]);
		expect(
			buildDecodedFallbackTrail("/workouts/create")!.map((b) => b.label),
		).toEqual(["Dashboard", "Mis entrenamientos", "Crear entrenamiento"]);
	});

	it("guards auth/maintenance boundaries", () => {
		expect(isGuardedPath("/auth/login")).toBe(true);
		expect(isGuardedPath("/maintenance")).toBe(true);
		expect(isGuardedPath("/workouts/create")).toBe(false);
	});
});
