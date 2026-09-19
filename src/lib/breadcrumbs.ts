import { getExerciseById, getWorkoutBySlug } from "@/actions";
import {
	decodeFallback,
	getStaticTrail,
	hasDynamicPlaceholder,
	normalizePathname,
	STATIC_MAP,
	type Breadcrumb,
} from "./breadcrumb-trails";

// Re-export the pure, client-safe helpers so existing imports keep working.
export {
	STATIC_MAP,
	decodeFallback,
	getStaticTrail,
	hasDynamicPlaceholder,
	normalizePathname,
	isGuardedPath,
	buildDecodedFallbackTrail,
	type Breadcrumb,
} from "./breadcrumb-trails";

export async function resolveDynamicLabel(
	seg: "id" | "slug",
	val: string,
	userId?: string,
): Promise<string> {
	const fallback = decodeFallback(val);
	if (!userId) return fallback;

	try {
		if (seg === "id") {
			const exercise = await getExerciseById(val, userId);
			if (exercise && (exercise as { name?: string }).name) {
				return (exercise as { name: string }).name;
			}
			return fallback;
		} else {
			// For slug, decode before query (spec: decode before query/fallback)
			let decodedSlug: string;
			try {
				decodedSlug = decodeURIComponent(val);
			} catch {
				decodedSlug = val;
			}
			const workout = await getWorkoutBySlug(decodedSlug, userId);
			if (workout && (workout as { name?: string }).name) {
				return (workout as { name: string }).name;
			}
			return fallback;
		}
	} catch {
		return fallback;
	}
}

/** Resolve the full breadcrumb trail for a pathname. Pure except for the
 * dynamic label DB lookups. Exported for reuse by the server action and
 * tests. */
export async function buildBreadcrumbs(
	pathname: string,
	userId?: string,
): Promise<Breadcrumb[] | null> {
	const canonical = normalizePathname(pathname);
	const segments = canonical.split("/").filter(Boolean);

	// Direct static match
	const direct = getStaticTrail(canonical);
	if (direct) {
		// If trail contains __dynamic__, resolve it
		if (!hasDynamicPlaceholder(direct)) return direct;

		// Determine seg type from canonical pattern
		// /exercises/update/[id] -> id is last segment
		// /workouts/[slug] -> slug is last segment
		const lastSeg = segments[segments.length - 1] ?? "";
		const trail = [...direct];
		const lastIdx = trail.length - 1;

		if (canonical.startsWith("/exercises/update/")) {
			const label = await resolveDynamicLabel("id", lastSeg, userId);
			trail[lastIdx] = { label, isCurrent: true };
		} else if (canonical.startsWith("/workouts/") && segments.length === 2) {
			// /workouts/<slug> where slug != create
			if (lastSeg !== "create") {
				const label = await resolveDynamicLabel("slug", lastSeg, userId);
				trail[lastIdx] = { label, isCurrent: true };
			}
		}
		return trail;
	}

	// Fallback: try to match dynamic patterns
	// /exercises/update/<id> — exactly 3 segments
	if (
		segments.length === 3 &&
		segments[0] === "exercises" &&
		segments[1] === "update"
	) {
		const base = STATIC_MAP["/exercises/update/[id]"];
		if (base) {
			const lastSeg = segments[segments.length - 1] ?? "";
			const label = await resolveDynamicLabel("id", lastSeg, userId);
			return [base[0], base[1], { label, isCurrent: true }];
		}
	}

	// /workouts/<slug> — exactly 2 segments (/workouts/create stays static)
	if (
		segments.length === 2 &&
		segments[0] === "workouts" &&
		segments[1] !== "create"
	) {
		const base = STATIC_MAP["/workouts/[slug]"];
		if (base) {
			const lastSeg = segments[segments.length - 1] ?? "";
			const label = await resolveDynamicLabel("slug", lastSeg, userId);
			return [base[0], base[1], { label, isCurrent: true }];
		}
	}

	return null;
}
