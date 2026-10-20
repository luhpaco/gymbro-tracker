import { describe, expect, it } from "vitest";
import { LIVE_SESSION_KEY } from "@/lib/live-session-storage";
import { createLiveSessionStore } from "./live-session-store";

const BENCH = "22222222-2222-4222-8222-222222222222";

const memoryStorage = (initial: Record<string, string> = {}) => {
	const data = new Map(Object.entries(initial));
	return {
		data,
		storage: {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => void data.set(key, value),
			removeItem: (key: string) => void data.delete(key),
		},
	};
};

const setup = (initial: Record<string, string> = {}) => {
	const { data, storage } = memoryStorage(initial);
	let counter = 0;
	let clock = Date.parse("2026-10-20T10:00:00.000Z");
	const store = createLiveSessionStore({
		storage,
		newId: () => `id-${++counter}`,
		now: () => new Date(clock),
	});
	return {
		store,
		data,
		tick: (ms: number) => {
			clock += ms;
		},
	};
};

const sessionOf = (store: ReturnType<typeof setup>["store"]) => {
	const state = store.getState().state;
	if (state.status !== "active" && state.status !== "finishing") {
		throw new Error(`no session in ${state.status}`);
	}
	return state.session;
};

describe("live session store", () => {
	it("starts without a session and not hydrated", () => {
		const { store } = setup();
		expect(store.getState().state).toEqual({ status: "none" });
		expect(store.getState().hydrated).toBe(false);
	});

	it("starts a session with a generated id and persists it", () => {
		const { store, data } = setup();
		store.getState().start();
		expect(sessionOf(store)).toEqual({
			id: "id-1",
			startedAt: "2026-10-20T10:00:00.000Z",
			exercises: [],
		});
		expect(data.has(LIVE_SESSION_KEY)).toBe(true);
	});

	it("does not replace a running session when start is called again", () => {
		const { store } = setup();
		store.getState().start();
		const first = sessionOf(store);
		store.getState().start();
		expect(sessionOf(store)).toBe(first);
	});

	it("hydrates a stored session after a reload", () => {
		const first = setup();
		first.store.getState().start();
		first.store.getState().addExercise(BENCH, "Bench press");
		const second = setup(Object.fromEntries(first.data));
		expect(second.store.getState().hydrated).toBe(false);
		second.store.getState().hydrate();
		expect(second.store.getState().hydrated).toBe(true);
		expect(sessionOf(second.store).exercises[0].exerciseName).toBe(
			"Bench press",
		);
	});

	it("adds a set that copies the previous set of the same exercise", () => {
		const { store } = setup();
		store.getState().start();
		store.getState().addExercise(BENCH, "Bench press");
		const localId = sessionOf(store).exercises[0].localId;

		store.getState().addSet(localId);
		expect(sessionOf(store).exercises[0].sets[0]).toMatchObject({
			weight: 0,
			reps: 0,
			isWarmup: false,
			doneAt: null,
		});

		const firstSetId = sessionOf(store).exercises[0].sets[0].id;
		store.getState().updateSet(localId, firstSetId, { weight: 60, reps: 8 });
		store.getState().addSet(localId);
		expect(sessionOf(store).exercises[0].sets[1]).toMatchObject({
			weight: 60,
			reps: 8,
			isWarmup: false,
		});
	});

	it("toggles a set done with the current time and undoes it", () => {
		const { store, tick } = setup();
		store.getState().start();
		store.getState().addExercise(BENCH, "Bench press");
		const localId = sessionOf(store).exercises[0].localId;
		store.getState().addSet(localId);
		const setId = sessionOf(store).exercises[0].sets[0].id;

		tick(60_000);
		store.getState().toggleSetDone(localId, setId);
		expect(sessionOf(store).exercises[0].sets[0].doneAt).toBe(
			"2026-10-20T10:01:00.000Z",
		);
		store.getState().toggleSetDone(localId, setId);
		expect(sessionOf(store).exercises[0].sets[0].doneAt).toBeNull();
	});

	it("finishes into the persisted upload queue and can reopen after a refusal", () => {
		const { store, data, tick } = setup();
		store.getState().start();
		store.getState().addExercise(BENCH, "Bench press");
		const localId = sessionOf(store).exercises[0].localId;
		store.getState().addSet(localId);
		const setId = sessionOf(store).exercises[0].sets[0].id;
		store.getState().updateSet(localId, setId, { weight: 60, reps: 8 });
		store.getState().toggleSetDone(localId, setId);

		tick(30 * 60_000);
		store.getState().finish("Push day");
		expect(store.getState().state.status).toBe("finishing");
		expect(JSON.parse(data.get(LIVE_SESSION_KEY)!).state.status).toBe(
			"finishing",
		);

		store.getState().reopen();
		expect(store.getState().state.status).toBe("active");
	});

	it("clears the stored session once synced or discarded", () => {
		const synced = setup();
		synced.store.getState().start();
		synced.store.getState().addExercise(BENCH, "Bench press");
		const localId = sessionOf(synced.store).exercises[0].localId;
		synced.store.getState().addSet(localId);
		const setId = sessionOf(synced.store).exercises[0].sets[0].id;
		synced.store.getState().updateSet(localId, setId, { weight: 60, reps: 8 });
		synced.store.getState().toggleSetDone(localId, setId);
		synced.store.getState().finish("Push day");
		synced.store.getState().markSynced("w-1");
		expect(synced.store.getState().state).toEqual({
			status: "synced",
			workoutId: "w-1",
		});
		expect(synced.data.has(LIVE_SESSION_KEY)).toBe(false);

		const discarded = setup();
		discarded.store.getState().start();
		discarded.store.getState().discard();
		expect(discarded.store.getState().state).toEqual({ status: "discarded" });
		expect(discarded.data.has(LIVE_SESSION_KEY)).toBe(false);
	});

	it("reports staleness against the injected clock", () => {
		const { store, tick } = setup();
		store.getState().start();
		expect(store.getState().isStale()).toBe(false);
		tick(12 * 60 * 60 * 1000 + 1);
		expect(store.getState().isStale()).toBe(true);
	});
});
