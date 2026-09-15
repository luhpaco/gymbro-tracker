import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const RUN_INTEGRATION = process.env.RUN_EXERCISE_NAME_INTEGRATION === "1";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { normalizeExerciseName } from "@/lib/exercise-name";
import { isCanonicalUniquenessViolation } from "@/lib/exercises";
import { createExercise } from "@/actions/exercise/create-exercise";

const TEST_TAG = `integration-${Date.now()}`;
const userEmail = (tag: string) => `${TEST_TAG}-${tag}@example.com`;

const makeUser = async (tag: string) =>
	prisma.user.create({
		data: {
			email: userEmail(tag),
			firstName: "Integration",
			lastName: tag,
			password: "test-password-hash",
		},
	});

const makeExercise = (userId: string, rawName: string, suffix: string) => {
	const { canonicalName, name } = normalizeExerciseName(rawName);
	return prisma.exercise.create({
		data: {
			canonicalName,
			muscleGroupTag: "chest",
			name,
			tag: `${TEST_TAG}-${suffix}`,
			userId,
		},
	});
};

describe.skipIf(!RUN_INTEGRATION)(
	"exercise-name uniqueness integration",
	() => {
		let ownerA: { id: string };
		let ownerB: { id: string };

		beforeAll(async () => {
			ownerA = await makeUser("owner-a");
			ownerB = await makeUser("owner-b");
		});

		afterAll(async () => {
			await prisma.exercise.deleteMany({
				where: { userId: { in: [ownerA.id, ownerB.id] } },
			});
			await prisma.user.deleteMany({
				where: { email: { contains: TEST_TAG } },
			});
			await prisma.$disconnect();
		});

		it("enforces the scoped contract migration", async () => {
			const indexes: Array<{ indexname: string }> =
				await prisma.$queryRawUnsafe(
					`SELECT indexname FROM pg_indexes WHERE tablename = 'Exercise'`,
				);
			const names = indexes.map((row) => row.indexname);
			expect(names).toContain("Exercise_userId_canonicalName_key");
			expect(names).not.toContain("Exercise_name_key");
			expect(names).not.toContain("Exercise_userId_tag_key");
		});

		it("prohibits null canonical identity", async () => {
			await expect(
				prisma.exercise.create({
					data: {
						muscleGroupTag: "chest",
						name: "Null identity probe",
						tag: `${TEST_TAG}-null-probe`,
						userId: ownerA.id,
					} as never,
				}),
			).rejects.toMatchObject({ name: "PrismaClientValidationError" });
		});

		it("rejects same-owner duplicates while allowing cross-owner reuse", async () => {
			await makeExercise(ownerA.id, "Integration Press", "same-owner-1");

			await expect(
				makeExercise(ownerA.id, "  INTEGRATION   press  ", "same-owner-2"),
			).rejects.toMatchObject({ code: "P2002" });

			const crossOwner = await makeExercise(
				ownerB.id,
				"INTEGRATION press",
				"cross-owner-1",
			);
			expect(crossOwner.canonicalName).toBe("integration press");
		});

		it("allows self-rename without changing canonical identity", async () => {
			const row = await makeExercise(ownerA.id, "Self Rename Probe", "self-1");
			const renamed = await prisma.exercise.update({
				data: { name: "SELF   rename   probe" },
				where: { id: row.id },
			});
			expect(renamed.name).toBe("SELF   rename   probe");
		});

		it("resolves synchronized create/create races with one winner", async () => {
			vi.mocked(auth).mockResolvedValue({ user: { id: ownerA.id } } as never);
			const attempts = await Promise.allSettled([
				createExercise({ muscleGroupTag: "chest", name: "Race Press Alpha" }),
				createExercise({
					muscleGroupTag: "chest",
					name: "  RACE   press   ALPHA  ",
				}),
			]);
			const fulfilled = attempts.filter((r) => r.status === "fulfilled");
			expect(fulfilled).toHaveLength(2);
			const results = fulfilled.map(
				(r) =>
					(r as PromiseFulfilledResult<never>).value as {
						ok: boolean;
						code?: string;
					},
			);
			expect(results.filter((r) => r.ok)).toHaveLength(1);
			expect(
				results.filter((r) => !r.ok && r.code === "duplicate_name"),
			).toHaveLength(1);
		});

		it("resolves raw synchronized creates with P2002 on the loser", async () => {
			const first = normalizeExerciseName("Raw Race Press");
			const second = normalizeExerciseName("  RAW   RACE   press  ");
			expect(second.canonicalName).toBe(first.canonicalName);

			const attempts = await Promise.allSettled([
				prisma.exercise.create({
					data: {
						canonicalName: first.canonicalName,
						muscleGroupTag: "chest",
						name: first.name,
						tag: `${TEST_TAG}-raw-race-1`,
						userId: ownerB.id,
					},
				}),
				prisma.exercise.create({
					data: {
						canonicalName: second.canonicalName,
						muscleGroupTag: "chest",
						name: second.name,
						tag: `${TEST_TAG}-raw-race-2`,
						userId: ownerB.id,
					},
				}),
			]);
			const fulfilled = attempts.filter((r) => r.status === "fulfilled");
			const rejected = attempts.filter((r) => r.status === "rejected");
			expect(fulfilled).toHaveLength(1);
			expect(rejected).toHaveLength(1);
			const reason = (rejected[0] as PromiseRejectedResult).reason;
			expect(reason).toMatchObject({ code: "P2002" });
			expect(isCanonicalUniquenessViolation(reason)).toBe(true);
		});

		it("resolves rename/rename races with one winner", async () => {
			const first = await makeExercise(ownerA.id, "Rename Race One", "rr-1");
			const second = await makeExercise(ownerA.id, "Rename Race Two", "rr-2");
			const target = normalizeExerciseName("Rename Race Winner");

			const attempts = await Promise.allSettled([
				prisma.exercise.update({
					data: { canonicalName: target.canonicalName, name: target.name },
					where: { id: first.id },
				}),
				prisma.exercise.update({
					data: { canonicalName: target.canonicalName, name: target.name },
					where: { id: second.id },
				}),
			]);
			expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
			const rejected = attempts.filter((r) => r.status === "rejected");
			expect(rejected).toHaveLength(1);
			expect(
				isCanonicalUniquenessViolation(
					(rejected[0] as PromiseRejectedResult).reason,
				),
			).toBe(true);
		});

		it("resolves create/rename races with one winner", async () => {
			const existing = await makeExercise(
				ownerB.id,
				"Create Rename Base",
				"cr-base",
			);
			const target = normalizeExerciseName("Create Rename Target");

			const attempts = await Promise.allSettled([
				prisma.exercise.create({
					data: {
						canonicalName: target.canonicalName,
						muscleGroupTag: "chest",
						name: target.name,
						tag: `${TEST_TAG}-cr-new`,
						userId: ownerB.id,
					},
				}),
				prisma.exercise.update({
					data: { canonicalName: target.canonicalName, name: target.name },
					where: { id: existing.id },
				}),
			]);
			expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
			const rejected = attempts.filter((r) => r.status === "rejected");
			expect(rejected).toHaveLength(1);
			expect(
				isCanonicalUniquenessViolation(
					(rejected[0] as PromiseRejectedResult).reason,
				),
			).toBe(true);
		});
	},
);
