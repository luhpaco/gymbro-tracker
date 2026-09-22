import { defaultDateLib } from "react-day-picker";
import { describe, expect, it } from "vitest";

import {
	MAX_TAG_ATTEMPTS,
	buildWorkoutTag,
	isWorkoutTagCollision,
	nextTagCandidate,
} from "./workout-tag";

const uniqueViolation = (target: unknown) =>
	Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
		meta: { target },
	});

describe("buildWorkoutTag", () => {
	it("reproduces the existing formula for an ASCII name", () => {
		expect(
			buildWorkoutTag("Dia de pierna", new Date("2026-01-15T00:00:00.000Z")),
		).toBe("dia-de-pierna-workout-2026-01-15T00:00:00.000Z");
	});

	it("converts every whitespace character to a hyphen", () => {
		expect(
			buildWorkoutTag(
				"Pecho\t y  Triceps",
				new Date("2026-02-03T00:00:00.000Z"),
			),
		).toBe("pecho--y--triceps-workout-2026-02-03T00:00:00.000Z");
	});
});

describe("nextTagCandidate", () => {
	it.each([
		[0, "base"],
		[1, "base"],
		[2, "base-2"],
		[3, "base-3"],
		[10, "base-10"],
	])("attempt %i yields %s", (attempt, expected) => {
		expect(nextTagCandidate("base", attempt)).toBe(expected);
	});
});

describe("MAX_TAG_ATTEMPTS", () => {
	it("bounds the retry at ten attempts", () => {
		expect(MAX_TAG_ATTEMPTS).toBe(10);
	});
});

describe("isWorkoutTagCollision", () => {
	it.each([
		["the userId/tag array", ["userId", "tag"]],
		["the reversed array", ["tag", "userId"]],
		["the constraint name", "Workout_userId_tag_key"],
	])("matches a P2002 targeting %s", (_label, target) => {
		expect(isWorkoutTagCollision(uniqueViolation(target))).toBe(true);
	});

	it.each([
		["the id primary key", ["id"]],
		["the name column", ["name"]],
		["the exercise canonical constraint", ["userId", "canonicalName"]],
		["a partial array", ["tag"]],
		["a longer array", ["userId", "tag", "id"]],
		["another constraint name", "Exercise_userId_canonicalName_key"],
		["a missing target", undefined],
	])("rejects a P2002 targeting %s", (_label, target) => {
		expect(isWorkoutTagCollision(uniqueViolation(target))).toBe(false);
	});

	it("rejects a P2002 without meta", () => {
		expect(
			isWorkoutTagCollision(Object.assign(new Error("x"), { code: "P2002" })),
		).toBe(false);
	});

	it("rejects a different error code even with the tag target", () => {
		expect(
			isWorkoutTagCollision(
				Object.assign(new Error("Record not found"), {
					code: "P2025",
					meta: { target: ["userId", "tag"] },
				}),
			),
		).toBe(false);
	});

	it.each([
		["null", null],
		["undefined", undefined],
		["a string", "P2002"],
		["a plain object", {}],
		["a plain Error", new Error("boom")],
	])("rejects %s", (_label, value) => {
		expect(isWorkoutTagCollision(value)).toBe(false);
	});
});

describe("react-day-picker day cells", () => {
	// The calendar builds its day cells from these primitives. Pinning local
	// midnight keeps buildWorkoutTag a pure function of (name, calendar day).
	const expectLocalMidnight = (date: Date) => {
		expect([
			date.getHours(),
			date.getMinutes(),
			date.getSeconds(),
			date.getMilliseconds(),
		]).toEqual([0, 0, 0, 0]);
	};

	it("normalizes any time of day to local midnight", () => {
		expectLocalMidnight(
			defaultDateLib.startOfDay(new Date(2026, 0, 15, 13, 45, 30, 500)),
		);
	});

	it("keeps local midnight across a generated month grid", () => {
		const gridStart = defaultDateLib.startOfWeek(
			defaultDateLib.startOfMonth(new Date(2026, 2, 15, 18, 20)),
		);
		const cells = Array.from({ length: 42 }, (_, index) =>
			defaultDateLib.addDays(gridStart, index),
		);

		expect(cells).toHaveLength(42);
		cells.forEach(expectLocalMidnight);
	});
});
