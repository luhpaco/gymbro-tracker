"use client";

import { logout } from "@/actions";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkoutStore } from "@/store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { FaHouse } from "react-icons/fa6";
import { FiActivity, FiLogOut, FiPlus } from "react-icons/fi";
import { GiGymBag } from "react-icons/gi";
import {
	isNavigationDestinationActive,
	shouldSuppressMobileDock,
} from "./navigation-state";

type NavigationDestination = {
	label: string;
	href: "/dashboard" | "/exercises" | "/workouts";
	icon: ReactNode;
};

type CreateAction = {
	label: string;
	href: "/exercises/create" | "/workouts/create";
	icon: ReactNode;
};

const destinations: NavigationDestination[] = [
	{ label: "Dashboard", href: "/dashboard", icon: <FaHouse aria-hidden /> },
	{ label: "Exercises", href: "/exercises", icon: <GiGymBag aria-hidden /> },
	{ label: "Workouts", href: "/workouts", icon: <FiActivity aria-hidden /> },
];

const createActions: CreateAction[] = [
	{
		label: "Create exercise",
		href: "/exercises/create",
		icon: <FiPlus aria-hidden />,
	},
	{
		label: "Create workout",
		href: "/workouts/create",
		icon: <FiPlus aria-hidden />,
	},
];

function DestinationLink({
	destination,
	pathname,
	className,
}: {
	destination: NavigationDestination;
	pathname: string;
	className?: string;
}) {
	const isActive = isNavigationDestinationActive(pathname, destination.href);

	return (
		<Link
			href={destination.href}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				"flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isActive
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
				className,
			)}
		>
			{destination.icon}
			<span>{destination.label}</span>
		</Link>
	);
}

function CreateActions({
	className,
	closeDialog = false,
}: {
	className?: string;
	closeDialog?: boolean;
}) {
	return (
		<div className={cn("flex flex-col gap-2", className)}>
			{createActions.map((action) => {
				const link = (
					<Link
						href={action.href}
						className='flex min-h-11 items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
					>
						{action.icon}
						{action.label}
					</Link>
				);

				return closeDialog ? (
					<DialogClose asChild key={action.href}>
						{link}
					</DialogClose>
				) : (
					<div key={action.href}>{link}</div>
				);
			})}
		</div>
	);
}

export function AuthenticatedNavigationShell({
	children,
}: {
	children: ReactNode;
}) {
	const pathname = usePathname();
	const exerciseCount = useWorkoutStore((state) => state.exercises.length);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const dockSuppressed = shouldSuppressMobileDock(pathname, exerciseCount);

	return (
		<div className='min-h-screen bg-background text-foreground'>
			<aside className='fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-secondary p-4 lg:flex'>
				<Link
					href='/dashboard'
					className='mb-8 flex min-h-11 items-center text-xl font-display uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
				>
					Gymbro Tracker
				</Link>
				<nav aria-label='Primary navigation' className='flex flex-col gap-2'>
					{destinations.map((destination) => (
						<DestinationLink
							key={destination.href}
							destination={destination}
							pathname={pathname}
							className='justify-start'
						/>
					))}
				</nav>
				<div className='mt-8 border-t border-border pt-4'>
					<p className='mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
						Create
					</p>
					<CreateActions />
				</div>
				<button
					type='button'
					onClick={() => logout()}
					className='mt-auto flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
				>
					<FiLogOut aria-hidden />
					Log out
				</button>
			</aside>

			<div
				className={cn(
					"min-h-screen lg:pl-64",
					dockSuppressed
						? "pb-6"
						: "pb-[calc(5.5rem+env(safe-area-inset-bottom))]",
				)}
			>
				{children}
			</div>

			{!dockSuppressed && (
				<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
					<nav
						aria-label='Mobile navigation'
						className='fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-secondary px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden'
					>
						{destinations.map((destination) => (
							<DestinationLink
								key={destination.href}
								destination={destination}
								pathname={pathname}
								className='flex-col gap-1 px-1 text-xs'
							/>
						))}
						<DialogTrigger asChild>
							<button
								type='button'
								aria-label='Create'
								className='flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
							>
								<FiPlus aria-hidden />
								<span>Create</span>
							</button>
						</DialogTrigger>
					</nav>
					<DialogContent className='inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-xl border-border bg-secondary px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-t-xl'>
						<DialogHeader>
							<DialogTitle>Create</DialogTitle>
							<DialogDescription>
								Choose what you want to create.
							</DialogDescription>
						</DialogHeader>
						<CreateActions className='mt-2' closeDialog />
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
