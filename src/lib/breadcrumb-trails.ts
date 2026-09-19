/**
 * Pure breadcrumb trail helpers.
 *
 * Client-safe: this module has zero server-only imports, so it can be
 * imported from Client Components (e.g. BreadcrumbsClient) without pulling
 * Prisma or other Node-only code into the browser bundle.
 *
 * Dynamic label resolution (DB lookups) stays in `./breadcrumbs`, which
 * re-exports everything defined here for backward compatibility.
 */

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

/**
 * Normalize a raw pathname for trail matching: strips the `(routes)`
 * group, collapses duplicate slashes, removes a trailing slash and
 * decodes each segment (keeping the `/` structure). Pure.
 */
export function normalizePathname(pathname: string): string {
	const withoutQuery = pathname.split("?")[0].split("#")[0];
	let p = normalizeCanonical(withoutQuery);
	try {
		p = p
			.split("/")
			.map((seg) => {
				if (!seg) return seg;
				try {
					return decodeURIComponent(seg);
				} catch {
					return seg;
				}
			})
			.join("/");
	} catch {
		// ignore
	}
	return p;
}

export function getStaticTrail(canonical: string): Breadcrumb[] | null {
	const normalized = normalizeCanonical(canonical);
	const trail = STATIC_MAP[normalized];
	if (trail) return trail;
	return null;
}

export function hasDynamicPlaceholder(trail: Breadcrumb[]): boolean {
	return trail.some((b) => b.label === "__dynamic__");
}

/**
 * Routes where breadcrumbs must never render (auth/maintenance
 * boundaries). Pure so both server and client can guard.
 */
export function isGuardedPath(pathname: string): boolean {
	return pathname.startsWith("/auth") || pathname.startsWith("/maintenance");
}

function withDecodedLastSegment(
	base: Breadcrumb[],
	lastSeg: string,
): Breadcrumb[] {
	return base.map((b) =>
		b.label === "__dynamic__"
			? { label: decodeFallback(lastSeg), isCurrent: true }
			: b,
	);
}

/**
 * Synchronous trail for a pathname, using the decoded URL segment as the
 * label for dynamic routes. Never touches the DB — the client renders this
 * immediately on navigation (so it never shows another route's trail) and
 * upgrades to the resolved label once the server action responds.
 * Returns null for unknown routes.
 */
export function buildDecodedFallbackTrail(
	pathname: string,
): Breadcrumb[] | null {
	const canonical = normalizePathname(pathname);
	const segments = canonical.split("/").filter(Boolean);

	// Direct static match (covers fully static trails and the literal
	// `[id]`/`[slug]` patterns, whose placeholder gets decoded).
	const direct = getStaticTrail(canonical);
	if (direct) {
		if (!hasDynamicPlaceholder(direct)) return direct;
		const lastSeg = segments[segments.length - 1] ?? "";
		return withDecodedLastSegment(direct, lastSeg);
	}

	// /exercises/update/<id> — exactly 3 segments
	if (
		segments.length === 3 &&
		segments[0] === "exercises" &&
		segments[1] === "update"
	) {
		const base = STATIC_MAP["/exercises/update/[id]"];
		if (base) {
			const lastSeg = segments[segments.length - 1] ?? "";
			return withDecodedLastSegment(base, lastSeg);
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
			return withDecodedLastSegment(base, lastSeg);
		}
	}

	return null;
}
