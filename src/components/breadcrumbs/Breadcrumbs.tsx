import * as React from "react";
import { BreadcrumbsClient } from "./BreadcrumbsClient";

/**
 * Server wrapper mounted once in `src/app/(routes)/layout.tsx`.
 * It delegates to {@link BreadcrumbsClient}, which resolves the pathname
 * with `usePathname()` so client-side navigations between sibling routes
 * (which do not re-render this shared layout) still refresh the trail.
 *
 * The optional `pathname` override is kept for tests/manual overrides; when
 * omitted the client uses the live navigation pathname.
 */
export function Breadcrumbs({ pathname }: { pathname?: string }) {
	return (
		<React.Suspense fallback={null}>
			<BreadcrumbsClient pathname={pathname} />
		</React.Suspense>
	);
}

export default Breadcrumbs;
