import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearDraft,
	loadDraft,
	saveDraft,
	type WorkoutDraft,
} from "./workout-draft";

function createMockStorage() {
	const data = new Map<string, string>();
	return {
		getItem: vi.fn((key: string) => data.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => {
			data.set(key, value);
		}),
		removeItem: vi.fn((key: string) => {
			data.delete(key);
		}),
		clear: vi.fn(() => data.clear()),
		key: vi.fn(() => null),
		get length() {
			return data.size;
		},
	};
}

describe("workout-draft", () => {
	let mockStorage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		mockStorage = createMockStorage();
		vi.stubGlobal("localStorage", mockStorage);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns null when nothing has been saved", () => {
		expect(loadDraft()).toBeNull();
	});

	it("round-trips a saved draft", () => {
		const draft: WorkoutDraft = {
			nameWorkout: "Día de pierna",
			dateWorkout: new Date("2026-01-15T00:00:00.000Z"),
			tagWorkout: "dia-de-pierna",
			listExercises: [
				{
					exerciseValue: "squat",
					exerciseName: "Squat",
					sets: [{ reps: 10, weight: 60 }],
				},
			],
		};

		saveDraft(draft);
		const loaded = loadDraft();

		expect(loaded).toEqual(draft);
	});

	it("returns null and does not throw when the stored value is invalid JSON", () => {
		mockStorage.setItem("gymbro:workout-draft:v1", "{not valid json");

		expect(() => loadDraft()).not.toThrow();
		expect(loadDraft()).toBeNull();
	});

	it("returns null and does not throw when the stored value fails schema validation", () => {
		mockStorage.setItem(
			"gymbro:workout-draft:v1",
			JSON.stringify({ unexpected: "shape" }),
		);

		expect(() => loadDraft()).not.toThrow();
		expect(loadDraft()).toBeNull();
	});

	it("removes the stored draft on clearDraft", () => {
		saveDraft({
			nameWorkout: "Día de espalda",
			dateWorkout: null,
			tagWorkout: "",
			listExercises: [],
		});

		clearDraft();

		expect(loadDraft()).toBeNull();
	});
});
