import { describe, expect, it, vi } from "vitest";

import {
	findCanonicalCollisions,
	planExerciseNameBackfill,
	runExerciseNameBackfill,
} from "./exercise-name-backfill";

describe("exercise-name backfill audit", () => {
	it("blocks migration on same-owner canonical collisions", () => {
		const collisions = findCanonicalCollisions([
			{ id: "a", name: "Bench Press", userId: "user-1" },
			{ id: "b", name: "  bench   PRESS  ", userId: "user-1" },
		]);

		expect(collisions).toHaveLength(1);
		expect(collisions[0].userId).toBe("user-1");
		expect(collisions[0].canonicalName).toBe("bench press");
		expect(collisions[0].ids).toEqual(expect.arrayContaining(["a", "b"]));
	});

	it("allows cross-owner canonical reuse", () => {
		const collisions = findCanonicalCollisions([
			{ id: "a", name: "Bench Press", userId: "user-1" },
			{ id: "b", name: "bench press", userId: "user-2" },
		]);

		expect(collisions).toHaveLength(0);
	});

	it("plans display-preserving backfill rows with canonical identity", () => {
		const plan = planExerciseNameBackfill([
			{ id: "a", name: "  PRESS   banca  ", userId: "user-1" },
		]);

		expect(plan).toEqual([
			{ canonicalName: "press banca", id: "a", name: "PRESS banca" },
		]);
	});
});

describe("exercise-name backfill execution guards", () => {
	it("refuses without explicit authorized database and write opt-in", async () => {
		const prisma = { exercise: { findMany: vi.fn(), update: vi.fn() } };

		await expect(
			runExerciseNameBackfill({ prisma: prisma as never }),
		).resolves.toMatchObject({ ok: false });

		expect(prisma.exercise.findMany).not.toHaveBeenCalled();
		expect(prisma.exercise.update).not.toHaveBeenCalled();
	});

	it("makes zero writes on dry runs even when authorized", async () => {
		const prisma = {
			exercise: {
				findMany: vi
					.fn()
					.mockResolvedValue([
						{ canonicalName: null, id: "a", name: "Press banca" },
					]),
				update: vi.fn(),
			},
		};

		const result = await runExerciseNameBackfill({
			allowWrite: true,
			authorizedConnection: true,
			dryRun: true,
			prisma: prisma as never,
		});

		expect(result.ok).toBe(true);
		expect(prisma.exercise.update).not.toHaveBeenCalled();
	});

	it("retries interrupted backfill and preserves row identity", async () => {
		const prisma = {
			exercise: {
				findMany: vi.fn().mockResolvedValue([
					{ canonicalName: null, id: "a", name: "Press banca" },
					{ canonicalName: "press banca", id: "b", name: "Press banca" },
				]),
				update: vi.fn().mockResolvedValue({ id: "a" }),
			},
		};

		const result = await runExerciseNameBackfill({
			allowWrite: true,
			authorizedConnection: true,
			dryRun: false,
			prisma: prisma as never,
		});

		expect(result.ok).toBe(true);
		expect(prisma.exercise.update).toHaveBeenCalledTimes(1);
		expect(prisma.exercise.update).toHaveBeenCalledWith({
			data: { canonicalName: "press banca", name: "Press banca" },
			where: { id: "a" },
		});
	});
});
