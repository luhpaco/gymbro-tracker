import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	create: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
	default: {
		workout: {
			create: mocks.create,
		},
	},
}));

import { createWorkout } from "./create-workout";

type FormData = Parameters<typeof createWorkout>[0];

const buildInput = (overrides: Record<string, unknown> = {}): FormData =>
	({
		nameWorkout: "Dia de pierna",
		dateWorkout: new Date("2026-01-15T00:00:00.000Z"),
		tagWorkout: "",
		listExercises: [
			{
				exerciseValue: "squat",
				exerciseName: "Squat",
				sets: [
					{ reps: 10, weight: 60, isWarmup: true },
					{ reps: 8, weight: 80, isWarmup: false },
				],
			},
		],
		...overrides,
	}) as FormData;

const createdData = (callIndex = 0) =>
	mocks.create.mock.calls[callIndex][0].data;

describe("createWorkout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.create.mockResolvedValue({ id: "workout-1" });
	});

	it("returns unauthorized without touching the database when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(createWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "unauthorized",
		});

		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("returns invalid_input without touching the database when validation fails", async () => {
		await expect(
			createWorkout(buildInput({ nameWorkout: "" })),
		).resolves.toEqual({ ok: false, code: "invalid_input" });

		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("persists each set with its server-assigned order and warmup flag", async () => {
		await expect(createWorkout(buildInput())).resolves.toEqual({
			ok: true,
			workout: { id: "workout-1" },
		});

		expect(createdData().sets).toEqual({
			create: [
				{ exerciseId: "squat", order: 0, reps: 10, weight: 60, isWarmup: true },
				{ exerciseId: "squat", order: 1, reps: 8, weight: 80, isWarmup: false },
			],
		});
	});

	it("keeps the existing base tag formula for an ASCII name", async () => {
		await createWorkout(buildInput());

		expect(createdData().tag).toBe(
			"dia-de-pierna-workout-2026-01-15T00:00:00.000Z",
		);
	});

	it("ignores a client-supplied tag", async () => {
		await createWorkout(buildInput({ tagWorkout: "forged-tag" }));

		expect(createdData().tag).toBe(
			"dia-de-pierna-workout-2026-01-15T00:00:00.000Z",
		);
	});

	it("ignores a client-supplied per-set order", async () => {
		await createWorkout(
			buildInput({
				listExercises: [
					{
						exerciseValue: "squat",
						exerciseName: "Squat",
						sets: [
							{ reps: 10, weight: 60, isWarmup: false, order: 42 },
							{ reps: 8, weight: 80, isWarmup: false, order: 7 },
						],
					},
				],
			}),
		);

		expect(
			createdData().sets.create.map((row: { order: number }) => row.order),
		).toEqual([0, 1]);
	});

	it("assigns one continuous order across interleaved exercises", async () => {
		const set = { reps: 10, weight: 60, isWarmup: false };

		await createWorkout(
			buildInput({
				listExercises: [
					{ exerciseValue: "bench", exerciseName: "Bench", sets: [set] },
					{ exerciseValue: "squat", exerciseName: "Squat", sets: [set] },
					{ exerciseValue: "bench", exerciseName: "Bench", sets: [set] },
				],
			}),
		);

		expect(
			createdData().sets.create.map(
				(row: { exerciseId: string; order: number }) => [
					row.exerciseId,
					row.order,
				],
			),
		).toEqual([
			["bench", 0],
			["squat", 1],
			["bench", 2],
		]);
	});

	it("restarts the order at zero for every workout", async () => {
		await createWorkout(buildInput());
		await createWorkout(buildInput());

		expect(
			createdData(0).sets.create.map((row: { order: number }) => row.order),
		).toEqual([0, 1]);
		expect(
			createdData(1).sets.create.map((row: { order: number }) => row.order),
		).toEqual([0, 1]);
	});

	it("leaves the session boundaries unwritten", async () => {
		await createWorkout(buildInput());

		expect(createdData()).not.toHaveProperty("startedAt");
		expect(createdData()).not.toHaveProperty("endedAt");
	});
});
