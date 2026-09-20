import { describe, expect, it } from "vitest";
import {
	buildSetsForCreate,
	groupSetsByExercise,
	SET_ORDER_BY,
	sortSets,
} from "./workout-sets";

const set = (reps: number, weight = 40, isWarmup = false) => ({
	reps,
	weight,
	isWarmup,
});

describe("buildSetsForCreate", () => {
	it.each([
		{
			name: "a single exercise with three sets",
			input: [{ exerciseValue: "bench", sets: [set(1), set(2), set(3)] }],
			expected: [
				{ exerciseId: "bench", order: 0, reps: 1, weight: 40, isWarmup: false },
				{ exerciseId: "bench", order: 1, reps: 2, weight: 40, isWarmup: false },
				{ exerciseId: "bench", order: 2, reps: 3, weight: 40, isWarmup: false },
			],
		},
		{
			name: "two exercises continue the order without repeating",
			input: [
				{ exerciseValue: "bench", sets: [set(1), set(2)] },
				{ exerciseValue: "squat", sets: [set(3), set(4)] },
			],
			expected: [
				{ exerciseId: "bench", order: 0, reps: 1, weight: 40, isWarmup: false },
				{ exerciseId: "bench", order: 1, reps: 2, weight: 40, isWarmup: false },
				{ exerciseId: "squat", order: 2, reps: 3, weight: 40, isWarmup: false },
				{ exerciseId: "squat", order: 3, reps: 4, weight: 40, isWarmup: false },
			],
		},
		{
			name: "the same exercise on separate entries keeps a distinct order",
			input: [
				{ exerciseValue: "bench", sets: [set(1)] },
				{ exerciseValue: "squat", sets: [set(2)] },
				{ exerciseValue: "bench", sets: [set(3)] },
			],
			expected: [
				{ exerciseId: "bench", order: 0, reps: 1, weight: 40, isWarmup: false },
				{ exerciseId: "squat", order: 1, reps: 2, weight: 40, isWarmup: false },
				{ exerciseId: "bench", order: 2, reps: 3, weight: 40, isWarmup: false },
			],
		},
		{
			name: "isWarmup passes through per set",
			input: [
				{
					exerciseValue: "bench",
					sets: [set(10, 20, true), set(5, 60, false)],
				},
			],
			expected: [
				{ exerciseId: "bench", order: 0, reps: 10, weight: 20, isWarmup: true },
				{ exerciseId: "bench", order: 1, reps: 5, weight: 60, isWarmup: false },
			],
		},
		{ name: "an empty exercise list", input: [], expected: [] },
	])("assigns the workout-wide order for $name", ({ input, expected }) => {
		expect(buildSetsForCreate(input)).toEqual(expected);
	});

	it("never copies an order supplied on the input set", () => {
		const forged = { ...set(10), order: 99 };

		const [row] = buildSetsForCreate([
			{ exerciseValue: "bench", sets: [forged] },
		]);

		expect(row.order).toBe(0);
		expect(row).toEqual({
			exerciseId: "bench",
			order: 0,
			reps: 10,
			weight: 40,
			isWarmup: false,
		});
	});

	it("restarts the order at zero on every call", () => {
		const input = [{ exerciseValue: "bench", sets: [set(1), set(2)] }];

		const first = buildSetsForCreate(input);
		const second = buildSetsForCreate(input);

		expect(first.map((row) => row.order)).toEqual([0, 1]);
		expect(second.map((row) => row.order)).toEqual([0, 1]);
	});
});

const at = (seconds: number) => new Date(Date.UTC(2026, 0, 15, 0, 0, seconds));

describe("sortSets", () => {
	it("orders by order ascending even when ids sort the other way", () => {
		const sorted = sortSets([
			{ id: "c", order: 0, createdAt: at(0) },
			{ id: "b", order: 1, createdAt: at(0) },
			{ id: "a", order: 2, createdAt: at(0) },
		]);

		expect(sorted.map((row) => row.id)).toEqual(["c", "b", "a"]);
	});

	it("falls back to createdAt when order is equal", () => {
		const sorted = sortSets([
			{ id: "a", order: 0, createdAt: at(30) },
			{ id: "b", order: 0, createdAt: at(10) },
			{ id: "c", order: 0, createdAt: at(20) },
		]);

		expect(sorted.map((row) => row.id)).toEqual(["b", "c", "a"]);
	});

	it("falls back to id when order and createdAt are equal", () => {
		const sorted = sortSets([
			{ id: "b", order: 0, createdAt: at(0) },
			{ id: "c", order: 0, createdAt: at(0) },
			{ id: "a", order: 0, createdAt: at(0) },
		]);

		expect(sorted.map((row) => row.id)).toEqual(["a", "b", "c"]);
	});

	it("keeps a gapped order ascending", () => {
		const sorted = sortSets([
			{ id: "x", order: 3, createdAt: at(0) },
			{ id: "y", order: 0, createdAt: at(0) },
			{ id: "z", order: 1, createdAt: at(0) },
		]);

		expect(sorted.map((row) => row.order)).toEqual([0, 1, 3]);
	});

	it("does not mutate its input and returns the same sequence on repeat", () => {
		const input = [
			{ id: "b", order: 1, createdAt: at(0) },
			{ id: "a", order: 0, createdAt: at(0) },
		];

		const first = sortSets(input);
		const second = sortSets(input);

		expect(input.map((row) => row.id)).toEqual(["b", "a"]);
		expect(first).not.toBe(input);
		expect(second).toEqual(first);
	});
});

describe("groupSetsByExercise", () => {
	const row = (id: string, order: number, exerciseName: string) => ({
		id,
		order,
		createdAt: at(0),
		exercise: { name: exerciseName },
	});

	it("groups interleaved sets under one exercise in stored order", () => {
		const grouped = groupSetsByExercise([
			row("s1", 0, "Bench"),
			row("s2", 1, "Squat"),
			row("s3", 2, "Bench"),
		]);

		expect(Object.keys(grouped)).toEqual(["Bench", "Squat"]);
		expect(grouped["Bench"].map((entry) => entry.id)).toEqual(["s1", "s3"]);
		expect(grouped["Squat"].map((entry) => entry.id)).toEqual(["s2"]);
	});

	it("sorts unsorted input inside each group and by first appearance", () => {
		const grouped = groupSetsByExercise([
			row("s3", 2, "Bench"),
			row("s2", 1, "Squat"),
			row("s1", 0, "Bench"),
		]);

		expect(Object.keys(grouped)).toEqual(["Bench", "Squat"]);
		expect(grouped["Bench"].map((entry) => entry.id)).toEqual(["s1", "s3"]);
	});

	it("exposes the group-relative position as the array index", () => {
		const grouped = groupSetsByExercise([
			row("s1", 0, "Bench"),
			row("s2", 1, "Squat"),
			row("s3", 2, "Squat"),
			row("s4", 3, "Bench"),
		]);

		expect(
			grouped["Squat"].map((entry, index) => [index + 1, entry.id]),
		).toEqual([
			[1, "s2"],
			[2, "s3"],
		]);
		expect(
			grouped["Bench"].map((entry, index) => [index + 1, entry.id]),
		).toEqual([
			[1, "s1"],
			[2, "s4"],
		]);
	});
});

describe("SET_ORDER_BY", () => {
	it("mirrors the in-memory comparator", () => {
		expect(SET_ORDER_BY).toEqual([
			{ order: "asc" },
			{ createdAt: "asc" },
			{ id: "asc" },
		]);
	});
});
