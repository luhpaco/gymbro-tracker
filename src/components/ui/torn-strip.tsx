import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Athletic Tape & Wrap surface primitive.
 *
 * Two-layer split: a clipped paint `<span>` carries the torn `clip-path`
 * silhouette and drop-shadow, while the content sits in an unclipped sibling so
 * focus rings, overhanging tags, and box-shadows are never cut by the polygon.
 *
 * Variance is deterministic (no `Math.random`): `seed` hashes to a polygon
 * variant (a/b/c) and a tilt angle, so SSR and CSR render identically.
 */

type Tone = "default" | "charcoal" | "primary";

const tornStripVariants = cva("torn-strip-root relative isolate", {
	variants: {
		tone: {
			default: "text-card-foreground",
			charcoal: "text-secondary-foreground",
			primary: "text-primary-foreground",
		},
		flat: {
			true: "",
			false: "",
		},
	},
	defaultVariants: {
		tone: "default",
		flat: false,
	},
});

const tonePaint: Record<Tone, string> = {
	default: "bg-card",
	charcoal: "bg-secondary",
	primary: "bg-primary",
};

const TEAR_VARIANTS = ["", "torn-strip--b", "torn-strip--c"] as const;
const STRIP_ROTS = ["-0.6deg", "0.35deg", "-0.25deg", "0.5deg"] as const;

/** djb2 — small, deterministic, stable across server and client bundles. */
function hashSeed(seed?: string | number): number {
	if (seed === undefined) return 0;
	const value = String(seed);
	let hash = 5381;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i);
	}
	return hash >>> 0;
}

export interface TornStripProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof tornStripVariants> {
	seed?: string | number;
}

const TornStrip = React.forwardRef<HTMLDivElement, TornStripProps>(
	({ className, tone, flat = false, seed, children, ...props }, ref) => {
		const hash = hashSeed(seed);
		const variantClass = TEAR_VARIANTS[hash % TEAR_VARIANTS.length];
		const rot = flat ? undefined : STRIP_ROTS[hash % STRIP_ROTS.length];
		const toneKey: Tone = tone ?? "default";
		const contentChildren: React.ReactNode[] = [];
		const tagChildren: React.ReactNode[] = [];

		React.Children.forEach(children, (child) => {
			if (React.isValidElement(child) && child.type === TornStripTag) {
				tagChildren.push(child);
				return;
			}

			contentChildren.push(child);
		});

		return (
			<div
				ref={ref}
				className={cn(tornStripVariants({ tone, flat }), className)}
				style={
					rot
						? ({ "--strip-rot": rot } as React.CSSProperties)
						: undefined
				}
				{...props}
			>
				<span
					aria-hidden
					className={cn(
						"torn-strip absolute inset-0 -z-10",
						tonePaint[toneKey],
						variantClass
					)}
				/>
				<div className={cn("relative", flat ? "px-4 py-2" : "p-6")}>
					{contentChildren}
				</div>
				{tagChildren}
			</div>
		);
	}
);
TornStrip.displayName = "TornStrip";

function TornStripHeader({
	title,
	subTitle,
	className,
}: {
	title: string;
	subTitle?: string;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<h3>{title}</h3>
			{subTitle && (
				<p className='text-xs text-muted-foreground'>{subTitle}</p>
			)}
		</div>
	);
}
TornStripHeader.displayName = "TornStrip.Header";

function TornStripBody({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <div className={cn("w-full", className)}>{children}</div>;
}
TornStripBody.displayName = "TornStrip.Body";

function TornStripLink({
	text,
	href,
	className,
}: {
	text: string;
	href: string;
	className?: string;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"text-xs text-primary underline underline-offset-4 self-start",
				className
			)}
		>
			{text}
		</Link>
	);
}
TornStripLink.displayName = "TornStrip.Link";

function TornStripTag({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) {
	return (
		<span
			className={cn(
				"absolute -top-2 -right-2 inline-flex items-center rounded-sm bg-primary px-2 py-0.5 font-display text-xs uppercase tracking-wide text-primary-foreground",
				className
			)}
			{...props}
		>
			{children}
		</span>
	);
}
TornStripTag.displayName = "TornStrip.Tag";

const TornStripCompound = Object.assign(TornStrip, {
	Header: TornStripHeader,
	Body: TornStripBody,
	Link: TornStripLink,
	Tag: TornStripTag,
});

export { TornStripCompound as TornStrip, tornStripVariants };
