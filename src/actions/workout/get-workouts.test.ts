import { beforeEach, describe, expect, it, vi } from "vitest";
import { SET_ORDER_BY } from "@/lib/workout-sets";

const mocks = vi.hoisted(() => ({
	findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	default: {
		workout: {
			findMany: mocks.findMany,
		},
	},
}));

import { getWorkouts } from "./get-workouts";

const setRow = (id: string, order: number, exerciseName: string) => ({
	id,
	order,
	createdAt: new Date("2026-01-15T10:00:00.000Z"),
	exercise: { name: exerciseName },
});

const workoutRow = (sets: ReturnType<typeof setRow>[]) => ({
	id: "workout-1",
	name: "Dia de pierna",
	date: new Date("2026-01-15T00:00:00.000Z"),
	tag: "dia-de-pierna",
	sets,
});

describe("getWorkouts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findMany.mockResolvedValue([]);
	});

	it.each([
		[undefined, "desc"],
		["asc", "asc"],
		["desc", "desc"],
	] as const)(
		"orders workouts by date then createdAt in the caller's direction (%s)",
		async (orderByDate, direction) => {
			await getWorkouts({ userId: "user-1", orderByDate });

			const args = mocks.findMany.mock.calls[0][0];
			expect(args.where).toEqual({ userId: "user-1" });
			expect(args.orderBy).toEqual([
				{ date: direction },
				{ createdAt: direction },
			]);
		},
	);

	it("asks the database for sets in stored order", async () => {
		await getWorkouts({ userId: "user-1" });

		expect(mocks.findMany.mock.calls[0][0].include.sets.orderBy).toEqual(
			SET_ORDER_BY,
		);
	});

	it("returns sets grouped by exercise and sorted even when rows arrive out of order", async () => {
		mocks.findMany.mockResolvedValue([
			workoutRow([
				setRow("b2", 2, "Bench"),
				setRow("s1", 1, "Squat"),
				setRow("b1", 0, "Bench"),
			]),
		]);

		const [workout] = await getWorkouts({ userId: "user-1" });

		expect(Object.keys(workout.sets)).toEqual(["Bench", "Squat"]);
		expect(workout.sets.Bench.map((set) => set.id)).toEqual(["b1", "b2"]);
		expect(workout.sets.Squat.map((set) => set.id)).toEqual(["s1"]);
	});

	it("returns an empty list when the query throws", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.findMany.mockRejectedValue(new Error("db down"));

		expect(await getWorkouts({ userId: "user-1" })).toEqual([]);
	});
});
