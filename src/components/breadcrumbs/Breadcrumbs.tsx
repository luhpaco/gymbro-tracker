import * as React from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/auth";
import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbPage,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import {
	getStaticTrail,
	resolveDynamicLabel,
	STATIC_MAP,
	type Breadcrumb as BreadcrumbType,
} from "@/lib/breadcrumbs";
import { BreadcrumbsCollapse } from "./BreadcrumbsCollapse";

function stripRoutes(pathname: string): string {
	return pathname.replace(/\/\(routes\)/g, "");
}

function normalizePath(pathname: string): string {
	let p = stripRoutes(pathname);
	p = p.replace(/\/+/g, "/");
	if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
	if (!p.startsWith("/")) p = "/" + p;
	try {
		// decode each segment but keep structure
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
	// re-encode splitting? Keep as decoded for matching
	// But STATIC_MAP keys are not encoded, so we keep decoded slash path
	// For trailing logic, keep decoded
	return p;
}

/** Exported for testing / reuse — pure */
export async function buildBreadcrumbs(
	pathname: string,
	userId?: string,
): Promise<BreadcrumbType[] | null> {
	const canonical = normalizePath(pathname);

	// Direct static match
	const direct = getStaticTrail(canonical);
	if (direct) {
		// If trail contains __dynamic__, resolve it
		const hasDynamic = direct.some((b) => b.label === "__dynamic__");
		if (!hasDynamic) return direct;

		// Determine seg type from canonical pattern
		// /exercises/update/[id] -> id is last segment
		// /workouts/[slug] -> slug is last segment
		const segments = canonical.split("/").filter(Boolean);
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
	// /exercises/update/<id>
	if (canonical.startsWith("/exercises/update/")) {
		const base = STATIC_MAP["/exercises/update/[id]"];
		if (base) {
			const segments = canonical.split("/").filter(Boolean);
			const lastSeg = segments[segments.length - 1] ?? "";
			const label = await resolveDynamicLabel("id", lastSeg, userId);
			return [base[0], base[1], { label, isCurrent: true }];
		}
	}

	// /workouts/<slug>
	if (
		canonical.startsWith("/workouts/") &&
		canonical !== "/workouts" &&
		canonical !== "/workouts/create"
	) {
		const base = STATIC_MAP["/workouts/[slug]"];
		if (base) {
			const segments = canonical.split("/").filter(Boolean);
			const lastSeg = segments[segments.length - 1] ?? "";
			const label = await resolveDynamicLabel("slug", lastSeg, userId);
			return [base[0], base[1], { label, isCurrent: true }];
		}
	}

	return null;
}

async function getPathnameFromHeaders(): Promise<string | null> {
	try {
		const h = await headers();
		// Try common header keys set by Next/middleware/proxy (x-pathname is injected by middleware.ts)
		const candidates = [
			h.get("x-pathname"),
			h.get("x-invoke-path"),
			h.get("next-url"),
			h.get("x-matched-path"),
			h.get("x-next-url"),
		].filter(Boolean) as string[];

		for (const c of candidates) {
			// c may be full URL or pathname
			try {
				if (c.startsWith("http")) {
					return new URL(c).pathname;
				}
				if (c.startsWith("/")) return c.split("?")[0];
			} catch {
				continue;
			}
		}

		// referer is previous page, not current — do not use it
		// Return null so no trail is rendered rather than a misleading "/dashboard"
		return null;
	} catch {
		return null;
	}
}

export async function Breadcrumbs({ pathname }: { pathname?: string }) {
	let resolvedPath: string | null = pathname ?? null;
	if (!resolvedPath) {
		resolvedPath = await getPathnameFromHeaders();
	}
	if (!resolvedPath) return null;

	// Don't render on auth/maintenance boundaries — though this component is only mounted in (routes)/layout,
	// guard anyway for safety if reused elsewhere
	if (
		resolvedPath.startsWith("/auth") ||
		resolvedPath.startsWith("/maintenance")
	) {
		return null;
	}

	const session = await auth().catch(() => null);
	const userId = (session as unknown as { user?: { id?: string } })?.user?.id;

	const trail = await buildBreadcrumbs(resolvedPath, userId);
	if (!trail || trail.length === 0) return null;

	const isCollapsed = trail.length >= 4;

	// For collapse at <640px, we show first, ellipsis, last two? Spec says middle collapsed to …
	// We'll render all but hide middle via CSS at <640px when 4+ segments
	return (
		<div className='w-full py-2 px-4 sm:px-6 border-b bg-background'>
			<BreadcrumbsCollapse>
				<Breadcrumb>
					<BreadcrumbList className='flex-nowrap whitespace-nowrap'>
						{trail.map((crumb, idx) => {
							const isLast = idx === trail.length - 1;
							const isMiddle = idx > 0 && idx < trail.length - 1;
							// Collapse middle at narrow viewport when 4+ segments
							const hideOnMobile =
								isCollapsed && isMiddle && idx !== trail.length - 1;

							return (
								<React.Fragment key={`${crumb.label}-${idx}`}>
									<BreadcrumbItem
										className={
											hideOnMobile ? "hidden sm:inline-flex" : "inline-flex"
										}
									>
										{isLast || !crumb.href ? (
											<BreadcrumbPage
												className={
													isLast
														? "truncate max-w-[18ch]"
														: "truncate max-w-[12ch]"
												}
											>
												{crumb.label}
											</BreadcrumbPage>
										) : (
											<BreadcrumbLink
												href={crumb.href}
												className='truncate max-w-[12ch] inline-block'
											>
												{crumb.label}
											</BreadcrumbLink>
										)}
									</BreadcrumbItem>
									{!isLast && <BreadcrumbSeparator className='shrink-0' />}
									{/* Mobile collapsed ellipsis: show once between first and last when collapsed */}
									{isCollapsed && idx === 0 && (
										<BreadcrumbItem className='sm:hidden inline-flex items-center'>
											<BreadcrumbSeparator className='shrink-0' />
											<BreadcrumbEllipsis className='h-4 w-4' />
										</BreadcrumbItem>
									)}
								</React.Fragment>
							);
						})}
					</BreadcrumbList>
				</Breadcrumb>
			</BreadcrumbsCollapse>
		</div>
	);
}

export default Breadcrumbs;
