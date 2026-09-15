import { describe, expect, it, vi } from "vitest";

import {
	findOwnedExerciseByCanonicalName,
	isCanonicalUniquenessViolation,
} from "./exercises";

describe("isCanonicalUniquenessViolation", () => {
	it("maps canonical array targets in either order to true", () => {
		const forward = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
			meta: { target: ["userId", "canonicalName"] },
		});
		const reverse = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
			meta: { target: ["canonicalName", "userId"] },
		});

		expect(isCanonicalUniquenessViolation(forward)).toBe(true);
		expect(isCanonicalUniquenessViolation(reverse)).toBe(true);
	});

	it("maps the canonical constraint-name target to true", () => {
		const err = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
			meta: { target: "Exercise_userId_canonicalName_key" },
		});

		expect(isCanonicalUniquenessViolation(err)).toBe(true);
	});

	it("maps unrelated or malformed targets to false", () => {
		const otherArray = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
			meta: { target: ["name"] },
		});
		const legacyTag = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
			meta: { target: ["userId", "tag"] },
		});
		const malformed = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
		});
		const wrongCode = Object.assign(new Error("Record not found"), {
			code: "P2025",
			meta: { target: ["userId", "canonicalName"] },
		});

		expect(isCanonicalUniquenessViolation(otherArray)).toBe(false);
		expect(isCanonicalUniquenessViolation(legacyTag)).toBe(false);
		expect(isCanonicalUniquenessViolation(malformed)).toBe(false);
		expect(isCanonicalUniquenessViolation(wrongCode)).toBe(false);
		expect(isCanonicalUniquenessViolation(null)).toBe(false);
	});
});

describe("findOwnedExerciseByCanonicalName", () => {
	it("queries owner scope without filtering active state", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const prisma = { exercise: { findFirst } } as never;

		await findOwnedExerciseByCanonicalName(prisma, {
			canonicalName: "press banca",
			userId: "user-1",
		});

		expect(findFirst).toHaveBeenCalledWith({
			where: { canonicalName: "press banca", userId: "user-1" },
		});
	});

	it("excludes the renamed row from its own conflict check", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const prisma = { exercise: { findFirst } } as never;

		await findOwnedExerciseByCanonicalName(prisma, {
			canonicalName: "press banca",
			excludeId: "exercise-1",
			userId: "user-1",
		});

		expect(findFirst).toHaveBeenCalledWith({
			where: {
				canonicalName: "press banca",
				id: { not: "exercise-1" },
				userId: "user-1",
			},
		});
	});
});
