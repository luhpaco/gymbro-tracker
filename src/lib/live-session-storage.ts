import { z } from "zod";
import type { LiveSessionState } from "./live-session";

export const LIVE_SESSION_KEY = "gymbro:live-session:v1";
const STORAGE_VERSION = 1;

// The subset of Web Storage this module needs, so tests can pass a fake.
export type SessionStorageLike = Pick<
	Storage,
	"getItem" | "setItem" | "removeItem"
>;

// Plain numbers on purpose: an in-progress set may hold values (like 0 reps) that are
// not valid to save yet; the save rules are enforced when finishing, not when persisting.
const liveSetSchema = z.object({
	id: z.string(),
	weight: z.number(),
	reps: z.number(),
	isWarmup: z.boolean(),
	doneAt: z.string().nullable(),
});

const liveSessionSchema = z.object({
	id: z.string(),
	startedAt: z.string(),
	exercises: z.array(
		z.object({
			localId: z.string(),
			exerciseId: z.string(),
			exerciseName: z.string(),
			sets: z.array(liveSetSchema),
		}),
	),
});

// Only states that must survive a reload are persisted. `finishing` is the upload
// queue: it stays on the device until the server confirms it.
const persistedStateSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("active"), session: liveSessionSchema }),
	z.object({
		status: z.literal("finishing"),
		session: liveSessionSchema,
		name: z.string(),
		endedAt: z.string(),
	}),
]);

const envelopeSchema = z.object({
	version: z.literal(STORAGE_VERSION),
	state: persistedStateSchema,
});

const NONE: LiveSessionState = { status: "none" };

const defaultStorage = (): SessionStorageLike | undefined =>
	typeof localStorage === "undefined" ? undefined : localStorage;

export function loadLiveSession(
	storage: SessionStorageLike | undefined = defaultStorage(),
): LiveSessionState {
	if (!storage) return NONE;
	try {
		const raw = storage.getItem(LIVE_SESSION_KEY);
		if (!raw) return NONE;
		const parsed = envelopeSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data.state : NONE;
	} catch {
		return NONE;
	}
}

export function saveLiveSession(
	state: LiveSessionState,
	storage: SessionStorageLike | undefined = defaultStorage(),
): void {
	if (!storage) return;
	try {
		if (state.status === "active" || state.status === "finishing") {
			storage.setItem(
				LIVE_SESSION_KEY,
				JSON.stringify({ version: STORAGE_VERSION, state }),
			);
		} else {
			storage.removeItem(LIVE_SESSION_KEY);
		}
	} catch {
		// Best-effort persistence — quota exceeded or storage disabled must not break the session.
	}
}

export function clearLiveSession(
	storage: SessionStorageLike | undefined = defaultStorage(),
): void {
	if (!storage) return;
	try {
		storage.removeItem(LIVE_SESSION_KEY);
	} catch {
		// Best-effort cleanup.
	}
}
