import { AuthenticatedNavigationShell } from "@/components";
import { Breadcrumbs } from "@/components/breadcrumbs/Breadcrumbs";

export default function RoutesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<AuthenticatedNavigationShell>
			<Breadcrumbs />
			<main className='w-full h-full p-6'>{children}</main>
		</AuthenticatedNavigationShell>
	);
}
