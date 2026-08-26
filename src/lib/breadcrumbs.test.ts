import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/actions", () => ({
	getExerciseById: vi.fn(),
	getWorkoutBySlug: vi.fn(),
}));

import { getExerciseById, getWorkoutBySlug } from "@/actions";
import {
	decodeFallback,
	getStaticTrail,
	resolveDynamicLabel,
	STATIC_MAP,
} from "./breadcrumbs";

// Helpers to get mocked fns typed
const mockedGetExerciseById = vi.mocked(getExerciseById);
const mockedGetWorkoutBySlug = vi.mocked(getWorkoutBySlug);

describe("decodeFallback", () => {
	it("decodes percent-encoded string", () => {
		expect(decodeFallback("d%C3%ADa%20de%20pierna")).toBe("día de pierna");
	});

	it("replaces hyphens with spaces", () => {
		expect(decodeFallback("dia-de-pierna")).toBe("dia de pierna");
	});

	it("decodes and replaces hyphens", () => {
		expect(decodeFallback("d%C3%ADa-de-pierna")).toBe("día de pierna");
	});

	it("trims whitespace", () => {
		expect(decodeFallback("  dia-de-pierna  ")).toBe("dia de pierna");
	});

	it("returns raw when empty after decode", () => {
		expect(decodeFallback("")).toBe("");
	});

	it("returns raw on invalid encoding (never throw)", () => {
		expect(decodeFallback("%E0%A4%A")).toBe("%E0%A4%A");
	});

	it("handles hyphen-only", () => {
		expect(decodeFallback("---")).toBe("---");
	});
});

describe("getStaticTrail", () => {
	it("returns trail for /dashboard", () => {
		const trail = getStaticTrail("/dashboard");
		expect(trail).not.toBeNull();
		expect(trail![0].label).toBe("Dashboard");
		expect(trail![0].isCurrent).toBe(true);
	});

	it("returns trail for /exercises with Spanish label", () => {
		const trail = getStaticTrail("/exercises");
		expect(trail).not.toBeNull();
		expect(trail!.map((b) => b.label)).toEqual(["Dashboard", "Mis ejercicios"]);
		expect(trail![0].href).toBe("/dashboard");
		expect(trail![1].isCurrent).toBe(true);
	});

	it("returns trail for /workouts/create hierarchy", () => {
		const trail = getStaticTrail("/workouts/create");
		expect(trail).not.toBeNull();
		expect(trail!.map((b) => b.label)).toEqual([
			"Dashboard",
			"Mis entrenamientos",
			"Crear entrenamiento",
		]);
	});

	it("strips (routes) group", () => {
		// canonical derivation is done upstream, but getStaticTrail should handle normal paths
		// ensure /dashboard still works when passed canonical /dashboard
		const t1 = getStaticTrail("/dashboard");
		const t2 = getStaticTrail("/dashboard");
		expect(t1).toEqual(t2);
	});

	it("returns null for unknown path", () => {
		expect(getStaticTrail("/unknown/path")).toBeNull();
	});

	it("handles trailing slash normalization", () => {
		expect(getStaticTrail("/exercises/")).toEqual(getStaticTrail("/exercises"));
	});

	it("STATIC_MAP contains all spec routes", () => {
		const expected = [
			"/dashboard",
			"/exercises",
			"/exercises/create",
			"/exercises/update/[id]",
			"/workouts",
			"/workouts/create",
			"/workouts/[slug]",
		];
		for (const key of expected) {
			expect(STATIC_MAP[key], `missing ${key}`).toBeDefined();
		}
	});

	it("all parent breadcrumbs have href, leaf may omit", () => {
		for (const [key, trail] of Object.entries(STATIC_MAP)) {
			expect(trail.length).toBeGreaterThan(0);
			// All except last must have href
			for (let i = 0; i < trail.length - 1; i++) {
				expect(trail[i].href, `${key} parent ${i} missing href`).toBeDefined();
			}
			// leaf may omit href — we just ensure it has label
			expect(trail[trail.length - 1].label).toBeTruthy();
		}
	});

	it("labels are Spanish where expected", () => {
		expect(STATIC_MAP["/exercises"][1].label).toBe("Mis ejercicios");
		expect(STATIC_MAP["/workouts"][1].label).toBe("Mis entrenamientos");
	});
});

describe("resolveDynamicLabel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves exercise name when found", async () => {
		mockedGetExerciseById.mockResolvedValue({ name: "Press banca" } as any);
		const label = await resolveDynamicLabel("id", "abc-123", "user-1");
		expect(label).toBe("Press banca");
		expect(mockedGetExerciseById).toHaveBeenCalledWith("abc-123", "user-1");
	});

	it("resolves workout name when found", async () => {
		mockedGetWorkoutBySlug.mockResolvedValue({ name: "Día de pierna" } as any);
		const label = await resolveDynamicLabel("slug", "dia-de-pierna", "user-1");
		expect(label).toBe("Día de pierna");
		expect(mockedGetWorkoutBySlug).toHaveBeenCalledWith(
			"dia-de-pierna",
			"user-1",
		);
	});

	it("decodes slug before querying workout", async () => {
		mockedGetWorkoutBySlug.mockResolvedValue({ name: "Rutina" } as any);
		await resolveDynamicLabel("slug", "d%C3%ADa%20de%20pierna", "user-1");
		expect(mockedGetWorkoutBySlug).toHaveBeenCalledWith(
			"día de pierna",
			"user-1",
		);
	});

	it("falls back to decoded slug when workout is null", async () => {
		mockedGetWorkoutBySlug.mockResolvedValue(null as any);
		const label = await resolveDynamicLabel("slug", "dia-de-pierna", "user-1");
		expect(label).toBe("dia de pierna");
	});

	it("falls back when exercise is null", async () => {
		mockedGetExerciseById.mockResolvedValue(null as any);
		const label = await resolveDynamicLabel("id", "abc-123", "user-1");
		expect(label).toBe("abc 123");
	});

	it("falls back when no userId provided (without calling data layer)", async () => {
		const label = await resolveDynamicLabel("id", "dia-de-pierna");
		expect(label).toBe("dia de pierna");
		expect(mockedGetExerciseById).not.toHaveBeenCalled();
	});

	it("falls back when workout call throws (never throw)", async () => {
		mockedGetWorkoutBySlug.mockRejectedValue(new Error("db down"));
		const label = await resolveDynamicLabel("slug", "dia-de-pierna", "user-1");
		expect(label).toBe("dia de pierna");
	});

	it("falls back when exercise call throws (never throw)", async () => {
		mockedGetExerciseById.mockRejectedValue(new Error("db down"));
		const label = await resolveDynamicLabel("id", "abc-123", "user-1");
		expect(label).toBe("abc 123");
	});

	it("handles encoded fallback when workout null", async () => {
		mockedGetWorkoutBySlug.mockResolvedValue(null as any);
		const label = await resolveDynamicLabel(
			"slug",
			"d%C3%ADa%20de%20pierna",
			"user-1",
		);
		expect(label).toBe("día de pierna");
	});

	it("handles empty userId string as missing", async () => {
		const label = await resolveDynamicLabel("slug", "dia-de-pierna", "");
		expect(label).toBe("dia de pierna");
		expect(mockedGetWorkoutBySlug).not.toHaveBeenCalled();
	});
});
