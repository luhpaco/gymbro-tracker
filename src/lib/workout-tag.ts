export const MAX_TAG_ATTEMPTS = 10;
export const WORKOUT_TAG_CONSTRAINT_KEY = "Workout_userId_tag_key";

export const buildWorkoutTag = (name: string, date: Date): string =>
	name.toLowerCase().replace(/\s/g, "-") + "-workout-" + date.toISOString();

// A base tag ends in the ISO instant's `Z`, a suffixed one in `-<digits>`, so a
// suffixed tag can never equal another workout's base tag.
export const nextTagCandidate = (baseTag: string, attempt: number): string =>
	attempt <= 1 ? baseTag : `${baseTag}-${attempt}`;

export const isWorkoutTagCollision = (err: unknown): boolean => {
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
			target.length === 2 && target.includes("userId") && target.includes("tag")
		);
	}

	return target === WORKOUT_TAG_CONSTRAINT_KEY;
};
