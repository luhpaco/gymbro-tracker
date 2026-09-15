import { z } from "zod";
import { AddExerciseFormSchema } from "./schemas/workout";

const DRAFT_KEY = "gymbro:workout-draft:v1";

const dateFromIso = z.preprocess((value) => {
	if (typeof value === "string") return new Date(value);
	return value;
}, z.date().nullable());

const workoutDraftSchema = z.object({
	nameWorkout: z.string(),
	dateWorkout: dateFromIso,
	tagWorkout: z.string(),
	listExercises: z.array(AddExerciseFormSchema),
});

export type WorkoutDraft = z.infer<typeof workoutDraftSchema>;

export function saveDraft(data: WorkoutDraft): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
	} catch {
		// Best-effort persistence — quota exceeded or storage disabled must not break authoring.
	}
}

export function loadDraft(): WorkoutDraft | null {
	if (typeof localStorage === "undefined") return null;

	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return null;

		const parsed: unknown = JSON.parse(raw);
		const result = workoutDraftSchema.safeParse(parsed);
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

export function clearDraft(): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		// Best-effort cleanup — a storage error here must not break the save flow.
	}
}
