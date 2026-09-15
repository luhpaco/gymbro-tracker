import type { Exercise, PrismaClient } from "@prisma/client";

export const CANONICAL_CONSTRAINT_KEY = "Exercise_userId_canonicalName_key";

type PrismaExercisesDelegate = {
	findFirst: (args: unknown) => Promise<Exercise | null>;
};

type PrismaLike = {
	exercise: PrismaExercisesDelegate;
};

export const isCanonicalUniquenessViolation = (err: unknown): boolean => {
	if (typeof err !== "object" || err === null) return false;
	if (!("code" in err) || err.code !== "P2002") return false;
	const target =
		"meta" in err &&
		typeof err.meta === "object" &&
		err.meta !== null &&
		"target" in err.meta
			? (err.meta as { target?: unknown }).target
			: undefined;

	if (Array.isArray(target)) {
		return (
			target.length === 2 &&
			target.includes("userId") &&
			target.includes("canonicalName")
		);
	}

	return target === CANONICAL_CONSTRAINT_KEY;
};

export const findOwnedExerciseByCanonicalName = async (
	prisma: PrismaLike | PrismaClient,
	options: { userId: string; canonicalName: string; excludeId?: string },
): Promise<Exercise | null> => {
	const where: Record<string, unknown> = {
		canonicalName: options.canonicalName,
		userId: options.userId,
	};
	if (options.excludeId) {
		where.id = { not: options.excludeId };
	}

	return (prisma as PrismaLike).exercise.findFirst({ where });
};

export const findOwnedExerciseById = async (
	prisma: PrismaLike | PrismaClient,
	options: { id: string; userId: string },
): Promise<Exercise | null> =>
	(prisma as PrismaLike).exercise.findFirst({
		where: { id: options.id, userId: options.userId },
	});
