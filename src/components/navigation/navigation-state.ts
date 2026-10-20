export function shouldSuppressMobileDock(
	pathname: string,
	exerciseCount: number,
): boolean {
	return pathname === "/workouts/create" && exerciseCount > 0;
}

export function isNavigationDestinationActive(
	pathname: string,
	href: string,
): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

const LIVE_SESSION_PATH = "/workouts/live";

// The banner points back to the live screen, so it is pointless on that screen itself.
export function shouldShowLiveSessionBanner(
	pathname: string,
	status: "none" | "active" | "finishing" | "synced" | "discarded",
): boolean {
	if (status !== "active" && status !== "finishing") return false;
	return !(
		pathname === LIVE_SESSION_PATH ||
		pathname.startsWith(`${LIVE_SESSION_PATH}/`)
	);
}
