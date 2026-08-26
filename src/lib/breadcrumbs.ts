import { getExerciseById, getWorkoutBySlug } from "@/actions";

export type Breadcrumb = { label: string; href?: string; isCurrent?: boolean };

export const STATIC_MAP: Record<string, Breadcrumb[]> = {
	"/dashboard": [{ label: "Dashboard", isCurrent: true }],
	"/exercises": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis ejercicios", isCurrent: true },
	],
	"/exercises/create": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis ejercicios", href: "/exercises" },
		{ label: "Crear ejercicio", isCurrent: true },
	],
	"/exercises/update/[id]": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis ejercicios", href: "/exercises" },
		{ label: "__dynamic__", isCurrent: true },
	],
	"/workouts": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis entrenamientos", isCurrent: true },
	],
	"/workouts/create": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis entrenamientos", href: "/workouts" },
		{ label: "Crear entrenamiento", isCurrent: true },
	],
	"/workouts/[slug]": [
		{ label: "Dashboard", href: "/dashboard" },
		{ label: "Mis entrenamientos", href: "/workouts" },
		{ label: "__dynamic__", isCurrent: true },
	],
};

export function decodeFallback(raw: string): string {
	try {
		const decoded = decodeURIComponent(raw);
		const withSpaces = decoded.replace(/-/g, " ").trim();
		return withSpaces || raw;
	} catch {
		// invalid encoding — return raw with hyphens replaced if possible
		try {
			return raw.replace(/-/g, " ").trim() || raw;
		} catch {
			return raw;
		}
	}
}

function normalizeCanonical(canonical: string): string {
	// Strip (routes) group if present, remove trailing slash (except root)
	let c = canonical.replace(/\/\(routes\)/g, "");
	// Collapse duplicate slashes
	c = c.replace(/\/+/g, "/");
	if (c.length > 1 && c.endsWith("/")) c = c.slice(0, -1);
	if (!c.startsWith("/")) c = "/" + c;
	return c;
}

export function getStaticTrail(canonical: string): Breadcrumb[] | null {
	const normalized = normalizeCanonical(canonical);
	const trail = STATIC_MAP[normalized];
	if (trail) return trail;
	return null;
}

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
