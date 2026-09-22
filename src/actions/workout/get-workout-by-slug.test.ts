import { beforeEach, describe, expect, it, vi } from "vitest";
import { SET_ORDER_BY } from "@/lib/workout-sets";

const mocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	default: {
		workout: {
			findUnique: mocks.findUnique,
		},
	},
}));

import { getWorkoutBySlug } from "./get-workout-by-slug";

const setRow = (id: string, order: number, exerciseName: string) => ({
	id,
	order,
	createdAt: new Date("2026-01-15T10:00:00.000Z"),
	exercise: { name: exerciseName },
});

describe("getWorkoutBySlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findUnique.mockResolvedValue(null);
	});

	it.each(["user-1", "user-2"])(
		"resolves the tag through the owner-scoped composite key for %s",
		async (userId) => {
			await getWorkoutBySlug("dia-de-pierna", userId);

			const args = mocks.findUnique.mock.calls[0][0];
			expect(args.where).toEqual({
				userId_tag: { userId, tag: "dia-de-pierna" },
			});
		},
	);

	it("asks the database for sets in stored order", async () => {
		await getWorkoutBySlug("dia-de-pierna", "user-1");

		expect(mocks.findUnique.mock.calls[0][0].include.sets.orderBy).toEqual(
			SET_ORDER_BY,
		);
	});

	it("returns sets grouped by exercise and sorted even when rows arrive out of order", async () => {
		mocks.findUnique.mockResolvedValue({
			id: "workout-1",
			name: "Dia de pierna",
			date: new Date("2026-01-15T00:00:00.000Z"),
			tag: "dia-de-pierna",
			sets: [
				setRow("b2", 2, "Bench"),
				setRow("s1", 1, "Squat"),
				setRow("b1", 0, "Bench"),
			],
		});

		const workout = await getWorkoutBySlug("dia-de-pierna", "user-1");

		expect(workout?.tag).toBe("dia-de-pierna");
		expect(Object.keys(workout?.sets ?? {})).toEqual(["Bench", "Squat"]);
		expect(workout?.sets.Bench.map((set) => set.id)).toEqual(["b1", "b2"]);
		expect(workout?.sets.Squat.map((set) => set.id)).toEqual(["s1"]);
	});

	it("returns null when no workout matches the owner and tag", async () => {
		expect(await getWorkoutBySlug("someone-elses-tag", "user-1")).toBeNull();
	});

	it("returns null when the query throws", async () => {
		mocks.findUnique.mockRejectedValue(new Error("db down"));

		expect(await getWorkoutBySlug("dia-de-pierna", "user-1")).toBeNull();
	});
});
