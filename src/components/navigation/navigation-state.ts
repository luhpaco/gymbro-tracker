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
