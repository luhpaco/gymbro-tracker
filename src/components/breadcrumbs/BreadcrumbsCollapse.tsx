"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function BreadcrumbsCollapse({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"overflow-x-auto scrollbar-thin whitespace-nowrap",
				"flex items-center",
				className,
			)}
			style={{ scrollbarWidth: "thin" }}
		>
			{children}
		</div>
	);
}
