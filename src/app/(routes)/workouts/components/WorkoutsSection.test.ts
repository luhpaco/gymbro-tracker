import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(__dirname, "WorkoutsSection.tsx"), "utf-8");

describe("WorkoutsSection empty state (workouts-empty-state)", () => {
	it("renders a persistent Crear entrenamiento CTA linking to /workouts/create", () => {
		expect(source).toContain("Crear entrenamiento");
		expect(source).toContain("/workouts/create");
		expect(source).toContain("<Button asChild>");
	});

	it("renders the empty state only when the list is empty", () => {
		expect(source).toContain("workoutsToDisplay.length > 0");
		expect(source).toContain("No has creado ningún entrenamiento todavía...");
		expect(source).toContain("a crear uno!");
		expect(source).toContain("underline font-semibold");
	});

	it("keeps the existing workout cards in the non-empty branch", () => {
		expect(source).toContain("workoutsToDisplay.map((workout) => (");
		expect(source).toContain("Ver entrenamiento");
		expect(source).toContain("<TornStrip");
	});

	it("remains a server component without client directives or hooks", () => {
		expect(source).not.toContain("use client");
		expect(source).not.toContain("useState");
		expect(source).not.toContain("useEffect");
		expect(source).not.toContain("onClick");
	});
});
