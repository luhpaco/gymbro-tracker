"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
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
	buildDecodedFallbackTrail,
	getStaticTrail,
	hasDynamicPlaceholder,
	isGuardedPath,
	type Breadcrumb as BreadcrumbType,
} from "@/lib/breadcrumb-trails";
import { getBreadcrumbTrail } from "@/actions";
import { BreadcrumbsCollapse } from "./BreadcrumbsCollapse";

function TrailView({ trail }: { trail: BreadcrumbType[] }) {
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

type TrailState =
	| { kind: "hidden" }
	| { kind: "static"; trail: BreadcrumbType[] }
	| { kind: "dynamic"; fallback: BreadcrumbType[] };

/**
 * Client-side breadcrumbs. Reads the pathname via `usePathname()` so every
 * client-side navigation (including between sibling routes that share the
 * parent layout and therefore never re-render it) recomputes the trail.
 *
 * Static trails render synchronously. Dynamic trails
 * (`/exercises/update/[id]`, `/workouts/[slug]`) render the decoded-URL
 * fallback for the *current* pathname immediately — never a stale trail
 * from the previous route — and upgrade to the DB-resolved label once the
 * server action responds. Stale responses are ignored.
 */
export function BreadcrumbsClient({
	pathname: pathnameProp,
}: {
	pathname?: string;
}) {
	const routePathname = usePathname();
	const pathname = pathnameProp ?? routePathname;

	const state: TrailState = React.useMemo(() => {
		if (!pathname || isGuardedPath(pathname)) return { kind: "hidden" };
		const direct = getStaticTrail(pathname);
		if (direct && !hasDynamicPlaceholder(direct)) {
			return { kind: "static", trail: direct };
		}
		const fallback = buildDecodedFallbackTrail(pathname);
		if (!fallback) return { kind: "hidden" };
		return { kind: "dynamic", fallback };
	}, [pathname]);

	// Resolved (DB-backed) dynamic label for the current pathname.
	// `undefined` = still loading → keep showing the fallback.
	const [resolved, setResolved] = React.useState<BreadcrumbType[] | null>();

	React.useEffect(() => {
		if (state.kind !== "dynamic" || !pathname) return;
		let cancelled = false;
		setResolved(undefined);
		getBreadcrumbTrail(pathname).then(
			(trail) => {
				if (cancelled) return;
				setResolved(trail ?? state.fallback);
			},
			() => {
				if (cancelled) return;
				setResolved(state.fallback);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [state, pathname]);

	if (state.kind === "hidden") return null;
	if (state.kind === "static") return <TrailView trail={state.trail} />;
	return <TrailView trail={resolved ?? state.fallback} />;
}

export default BreadcrumbsClient;
