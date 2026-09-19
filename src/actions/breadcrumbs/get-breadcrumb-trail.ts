"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { buildBreadcrumbs, type Breadcrumb } from "@/lib/breadcrumbs";

const PathnameSchema = z
	.string()
	.trim()
	.min(1)
	.max(1024)
	.startsWith("/")
	.refine((p) => !p.includes("\\") && !p.includes("\0"), {
		message: "Invalid pathname",
	});

/**
 * Resolve the breadcrumb trail for a client-supplied pathname.
 * Auth is resolved server-side; the client only sends the pathname it
 * already sees via `usePathname()`. Never throws — returns null for
 * invalid/unknown paths so the client keeps its decoded fallback.
 */
export async function getBreadcrumbTrail(
	rawPathname: string,
): Promise<Breadcrumb[] | null> {
	const parsed = PathnameSchema.safeParse(rawPathname);
	if (!parsed.success) return null;

	try {
		const session = await auth().catch(() => null);
		const userId = (session as unknown as { user?: { id?: string } })?.user?.id;
		return await buildBreadcrumbs(parsed.data, userId);
	} catch {
		return null;
	}
}
