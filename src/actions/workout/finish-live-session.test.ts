import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	finishLiveSessionForUser: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/data/live-session-mutations", () => ({
	finishLiveSessionForUser: mocks.finishLiveSessionForUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { finishLiveSession } from "./finish-live-session";

const SESSION_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const input = (overrides: Record<string, unknown> = {}) => ({
	sessionId: SESSION_ID,
	name: "Evening workout",
	startedAt: "2026-01-15T17:00:00.000Z",
	endedAt: "2026-01-15T18:00:00.000Z",
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
	...overrides,
});

describe("finishLiveSession", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.finishLiveSessionForUser.mockResolvedValue({
			ok: true,
			created: true,
			workout: { id: SESSION_ID, tag: "session-tag" },
		});
	});

	it("rejects unauthorized callers before database work", async () => {
		mocks.auth.mockResolvedValue(null);
		await expect(finishLiveSession(input() as never)).resolves.toEqual({
			ok: false,
			code: "unauthorized",
		});
		expect(mocks.finishLiveSessionForUser).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
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
	])("rejects invalid input before data access %#", async (overrides) => {
		await expect(finishLiveSession(input(overrides) as never)).resolves.toEqual(
			{ ok: false, code: "invalid_input" },
		);
		expect(mocks.finishLiveSessionForUser).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("delegates normalized input and revalidates detail and list after a new save", async () => {
		await expect(finishLiveSession(input() as never)).resolves.toEqual({
			ok: true,
			workout: { id: SESSION_ID, tag: "session-tag" },
		});
		expect(mocks.finishLiveSessionForUser).toHaveBeenCalledWith(
			"user-1",
			expect.objectContaining({
				startedAt: new Date("2026-01-15T17:00:00.000Z"),
			}),
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			"/workouts/session-tag",
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("does not revalidate an idempotent retry", async () => {
		mocks.finishLiveSessionForUser.mockResolvedValue({
			ok: true,
			created: false,
			workout: { id: SESSION_ID, tag: "session-tag" },
		});
		await finishLiveSession(input() as never);
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps data-layer errors and does not revalidate", async () => {
		mocks.finishLiveSessionForUser.mockResolvedValue({
			ok: false,
			code: "exercise_not_found",
		});
		await expect(finishLiveSession(input() as never)).resolves.toEqual({
			ok: false,
			code: "exercise_not_found",
		});
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
