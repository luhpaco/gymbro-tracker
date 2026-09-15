import { caseFold } from "unicode-case-folding";

export interface NormalizedExerciseName {
	name: string;
	canonicalName: string;
}

const normalizeDisplayName = (raw: string): string =>
	raw.normalize("NFC").trim().replace(/\s+/g, " ");

export const normalizeExerciseName = (raw: string): NormalizedExerciseName => {
	const name = normalizeDisplayName(raw);
	const canonicalName = caseFold(name).normalize("NFC");

	return { canonicalName, name };
};

export const deriveExerciseTag = (displayName: string): string =>
	displayName.toLowerCase().replace(/\s/g, "-");
