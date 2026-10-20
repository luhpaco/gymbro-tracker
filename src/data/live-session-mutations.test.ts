import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	$transaction: vi.fn(),
	workoutFindUnique: vi.fn(),
	workoutFindFirst: vi.fn(),
	workoutCreate: vi.fn(),
	exerciseFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
	default: {
		$transaction: mocks.$transaction,
		workout: { findFirst: mocks.workoutFindFirst },
	},
}));

import { finishLiveSessionForUser } from "./live-session-mutations";

const USER_ID = "user-1";
const SESSION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const STARTED_AT = new Date("2026-01-15T17:00:00.000Z");
const ENDED_AT = new Date("2026-01-15T18:00:00.000Z");
const DONE_AT = new Date("2026-01-15T17:30:00.000Z");

const input = (overrides: Record<string, unknown> = {}) => ({
	sessionId: SESSION_ID,
	name: "Evening workout",
	startedAt: STARTED_AT,
	endedAt: ENDED_AT,
	exercises: [
		{
			exerciseId: EXERCISE_ID,
			sets: [{ reps: 8, weight: 40, isWarmup: false, doneAt: DONE_AT }],
		},
	],
	...overrides,
});

const tx = () => ({
	workout: {
		findUnique: mocks.workoutFindUnique,
		findFirst: mocks.workoutFindFirst,
		create: mocks.workoutCreate,
	},
	exercise: { findMany: mocks.exerciseFindMany },
});

const p2002 = (target: string | string[]) =>
	Object.assign(new Error("Unique constraint failed"), {
		code: "P2002",
		meta: { target },
	});

describe("finishLiveSessionForUser", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		const transaction = tx();
		mocks.$transaction.mockImplementation(
			(callback: (value: typeof transaction) => unknown) =>
				callback(transaction),
		);
		mocks.workoutFindUnique.mockResolvedValue(null);
		mocks.workoutFindFirst.mockResolvedValue(null);
		mocks.exerciseFindMany.mockResolvedValue([{ id: EXERCISE_ID }]);
		mocks.workoutCreate.mockResolvedValue({
			id: SESSION_ID,
			tag: "evening-workout-workout-2026-01-15T17:00:00.000Z",
			userId: USER_ID,
		});
	});

	it("creates the workout and all sets atomically with server-owned timestamps and order", async () => {
		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toMatchObject({
			ok: true,
			created: true,
			workout: { id: SESSION_ID },
		});

		expect(mocks.$transaction).toHaveBeenCalledTimes(1);
		expect(mocks.workoutFindUnique).toHaveBeenCalledWith({
			where: { id: SESSION_ID },
			include: { sets: true },
		});
		expect(mocks.exerciseFindMany).toHaveBeenCalledWith({
			where: { userId: USER_ID, id: { in: [EXERCISE_ID] } },
			select: { id: true },
		});
		expect(mocks.workoutCreate).toHaveBeenCalledWith({
			data: expect.objectContaining({
				id: SESSION_ID,
				userId: USER_ID,
				name: "Evening workout",
				date: STARTED_AT,
				startedAt: STARTED_AT,
				endedAt: ENDED_AT,
				sets: {
					create: [
						{
							exerciseId: EXERCISE_ID,
							order: 0,
							reps: 8,
							weight: 40,
							isWarmup: false,
							createdAt: DONE_AT,
						},
					],
				},
			}),
			include: { sets: true },
		});
	});

	it("returns the existing owner-scoped session without inserting on retry", async () => {
		const existing = { id: SESSION_ID, userId: USER_ID, sets: [] };
		mocks.workoutFindUnique.mockResolvedValue(existing);

		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toEqual({ ok: true, created: false, workout: existing });
		expect(mocks.exerciseFindMany).not.toHaveBeenCalled();
		expect(mocks.workoutCreate).not.toHaveBeenCalled();
	});

	it("does not reveal a session id owned by another user", async () => {
		mocks.workoutFindUnique.mockResolvedValue({
			id: SESSION_ID,
			userId: "other-user",
			sets: [],
		});

		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toEqual({ ok: false, code: "error" });
		expect(mocks.exerciseFindMany).not.toHaveBeenCalled();
		expect(mocks.workoutCreate).not.toHaveBeenCalled();
	});

	it("returns exercise_not_found for missing or foreign exercise ids", async () => {
		mocks.exerciseFindMany.mockResolvedValue([]);

		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toEqual({ ok: false, code: "exercise_not_found" });
		expect(mocks.workoutCreate).not.toHaveBeenCalled();
	});

	it("re-reads the owner-scoped workout after an id primary-key race", async () => {
		const existing = { id: SESSION_ID, userId: USER_ID, sets: [] };
		mocks.workoutCreate.mockRejectedValueOnce(p2002("id"));
		mocks.workoutFindUnique
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(existing);
		mocks.workoutFindFirst.mockResolvedValue(existing);

		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toEqual({ ok: true, created: false, workout: existing });
		expect(mocks.workoutFindUnique).toHaveBeenCalledTimes(1);
		expect(mocks.workoutFindFirst).toHaveBeenCalledWith({
			where: { id: SESSION_ID, userId: USER_ID },
			include: { sets: true },
		});
		expect(mocks.workoutCreate).toHaveBeenCalledTimes(1);
	});

	it("retries tag collisions and stops with duplicate_tag after the maximum", async () => {
		mocks.workoutCreate.mockRejectedValue(p2002(["userId", "tag"]));

		await expect(
			finishLiveSessionForUser(USER_ID, input() as never),
		).resolves.toEqual({ ok: false, code: "duplicate_tag" });
		expect(mocks.workoutCreate).toHaveBeenCalledTimes(10);
		expect(mocks.workoutCreate.mock.calls[0][0].data.tag).toBe(
			"evening-workout-workout-2026-01-15T17:00:00.000Z",
		);
		expect(mocks.workoutCreate.mock.calls[1][0].data.tag).toBe(
			"evening-workout-workout-2026-01-15T17:00:00.000Z-2",
		);
	});

	it("ignores the client-supplied order", async () => {
		const payload = input({
			exercises: [
				{
					exerciseId: EXERCISE_ID,
					sets: [
						{
							reps: 8,
							weight: 40,
							isWarmup: false,
							doneAt: DONE_AT,
							order: 77,
						},
					],
				},
			],
		});
		await finishLiveSessionForUser(USER_ID, payload as never);

		expect(mocks.workoutCreate.mock.calls[0][0].data.sets.create[0].order).toBe(
			0,
		);
	});
});
