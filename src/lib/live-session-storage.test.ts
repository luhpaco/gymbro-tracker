import { describe, expect, it } from "vitest";
import {
	LIVE_SESSION_KEY,
	clearLiveSession,
	loadLiveSession,
	saveLiveSession,
} from "./live-session-storage";
import {
	type LiveSessionState,
	addExercise,
	addSet,
	beginFinish,
	completeSet,
	startSession,
} from "./live-session";

const memoryStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	const storage = {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
	};
	return { storage, data };
};

const throwingStorage = () => ({
	getItem: () => {
		throw new Error("storage disabled");
	},
	setItem: () => {
		throw new Error("quota exceeded");
	},
	removeItem: () => {
		throw new Error("storage disabled");
	},
});

const NONE: LiveSessionState = { status: "none" };
const T0 = "2026-10-20T10:00:00.000Z";
const T1 = "2026-10-20T10:05:00.000Z";

const activeWithSet = (reps = 0): LiveSessionState => {
	let state = startSession(NONE, {
		id: "11111111-1111-4111-8111-111111111111",
		now: T0,
	});
	state = addExercise(state, {
		localId: "ex-1",
		exerciseId: "22222222-2222-4222-8222-222222222222",
		exerciseName: "Bench press",
	});
	return addSet(state, "ex-1", {
		id: "set-1",
		weight: 60,
		reps,
		isWarmup: false,
	});
};

const finishing = (): LiveSessionState =>
	beginFinish(completeSet(activeWithSet(8), "ex-1", "set-1", T1), {
		name: "Push day",
		now: "2026-10-20T11:00:00.000Z",
	});

describe("live session storage", () => {
	it("uses its own versioned key, separate from the workout draft", () => {
		expect(LIVE_SESSION_KEY).toBe("gymbro:live-session:v1");
		expect(LIVE_SESSION_KEY).not.toContain("workout-draft");
	});

	it("round-trips an active session, including sets that are not valid yet", () => {
		const { storage } = memoryStorage();
		const state = activeWithSet();
		saveLiveSession(state, storage);
		expect(loadLiveSession(storage)).toEqual(state);
	});

	it("round-trips a finishing session so the upload survives a reload", () => {
		const { storage } = memoryStorage();
		const state = finishing();
		expect(state.status).toBe("finishing");
		saveLiveSession(state, storage);
		expect(loadLiveSession(storage)).toEqual(state);
	});

	it("removes the stored session when the state has nothing to keep", () => {
		for (const state of [
			NONE,
			{ status: "synced", workoutId: "w1" } as LiveSessionState,
			{ status: "discarded" } as LiveSessionState,
		]) {
			const { storage, data } = memoryStorage();
			saveLiveSession(activeWithSet(), storage);
			expect(data.has(LIVE_SESSION_KEY)).toBe(true);
			saveLiveSession(state, storage);
			expect(data.has(LIVE_SESSION_KEY)).toBe(false);
			expect(loadLiveSession(storage)).toEqual(NONE);
		}
	});

	it("clearLiveSession drops the stored session", () => {
		const { storage, data } = memoryStorage();
		saveLiveSession(activeWithSet(), storage);
		clearLiveSession(storage);
		expect(data.has(LIVE_SESSION_KEY)).toBe(false);
	});

	it("loads no session when nothing is stored", () => {
		expect(loadLiveSession(memoryStorage().storage)).toEqual(NONE);
	});

	it("falls back to no session for corrupt JSON, wrong version or wrong shape", () => {
		const cases = [
			"{not json",
			JSON.stringify({ version: 2, state: activeWithSet() }),
			JSON.stringify({ version: 1, state: { status: "active" } }),
			JSON.stringify({
				version: 1,
				state: { status: "synced", workoutId: "w1" },
			}),
			JSON.stringify({ version: 1 }),
			JSON.stringify(null),
			JSON.stringify("text"),
		];
		for (const raw of cases) {
			const { storage } = memoryStorage({ [LIVE_SESSION_KEY]: raw });
			expect(loadLiveSession(storage)).toEqual(NONE);
		}
	});

	it("never throws when storage is unavailable, full or missing", () => {
		const broken = throwingStorage();
		expect(loadLiveSession(broken)).toEqual(NONE);
		expect(() => saveLiveSession(activeWithSet(), broken)).not.toThrow();
		expect(() => clearLiveSession(broken)).not.toThrow();

		expect(loadLiveSession(undefined)).toEqual(NONE);
		expect(() => saveLiveSession(activeWithSet(), undefined)).not.toThrow();
		expect(() => clearLiveSession(undefined)).not.toThrow();
	});

	it("does not touch the workout draft key", () => {
		const draftKey = "gymbro:workout-draft:v1";
		const { storage, data } = memoryStorage({ [draftKey]: "draft" });
		saveLiveSession(activeWithSet(), storage);
		clearLiveSession(storage);
		expect(data.get(draftKey)).toBe("draft");
	});
});
