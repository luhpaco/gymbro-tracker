import { describe, expect, it } from "vitest";

import { FinishLiveSessionSchema } from "./live-session";

const SESSION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const validInput = () => ({
	sessionId: SESSION_ID,
	name: "Evening workout",
	startedAt: "2026-01-15T17:00:00.000Z",
	endedAt: new Date("2026-01-15T18:00:00.000Z"),
	exercises: [
		{
			exerciseId: EXERCISE_ID,
			sets: [
				{
					reps: 8,
					weight: 40,
					isWarmup: false,
					doneAt: "2026-01-15T17:30:00.000Z",
				},
			],
		},
	],
});

describe("FinishLiveSessionSchema", () => {
	it("normalizes Date and ISO string timestamps to Date values", () => {
		const result = FinishLiveSessionSchema.parse(validInput());

		expect(result.startedAt).toEqual(new Date("2026-01-15T17:00:00.000Z"));
		expect(result.endedAt).toEqual(new Date("2026-01-15T18:00:00.000Z"));
		expect(result.exercises[0].sets[0].doneAt).toEqual(
			new Date("2026-01-15T17:30:00.000Z"),
		);
	});

	it.each([
		{ sessionId: "bad-id" },
		{ exercises: [] },
		{ exercises: [{ exerciseId: EXERCISE_ID, sets: [] }] },
		{
			startedAt: "2026-01-15T18:00:00.000Z",
			endedAt: "2026-01-15T17:00:00.000Z",
		},
		{
			exercises: [
				{
					exerciseId: EXERCISE_ID,
					sets: [
						{
							reps: 8,
							weight: -1,
							isWarmup: false,
							doneAt: "2026-01-15T17:30:00.000Z",
						},
					],
				},
			],
		},
	])("rejects invalid live-session input %#", (overrides) => {
		const input = { ...validInput(), ...overrides };
		expect(FinishLiveSessionSchema.safeParse(input).success).toBe(false);
	});

	it("strips client-supplied set order", () => {
		const result = FinishLiveSessionSchema.parse({
			...validInput(),
			exercises: [
				{
					exerciseId: EXERCISE_ID,
					sets: [
						{
							reps: 8,
							weight: 40,
							isWarmup: false,
							doneAt: "2026-01-15T17:30:00.000Z",
							order: 99,
						},
					],
				},
			],
		});

		expect(result.exercises[0].sets[0]).not.toHaveProperty("order");
	});
});
