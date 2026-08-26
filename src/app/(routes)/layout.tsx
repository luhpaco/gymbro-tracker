import { Header } from "@/components";
import { Breadcrumbs } from "@/components/breadcrumbs/Breadcrumbs";

export default function RoutesLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<Header />
			<Breadcrumbs />
			<main className='w-full h-full p-6'>{children}</main>
		</>
	);
}
