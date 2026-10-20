"use client";

import Link from "next/link";
import { FiActivity } from "react-icons/fi";
import { useLiveSessionStore } from "@/store";

// Persistent reminder that a workout is open; it shows on every authenticated route
// except the live screen itself.
export function LiveSessionBanner() {
	const status = useLiveSessionStore((store) => store.state.status);
	return (
		<Link
			href='/workouts/live'
			className='sticky top-0 z-30 flex min-h-11 items-center justify-between gap-3 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
		>
			<span className='flex items-center gap-2'>
				<FiActivity aria-hidden />
				{status === "finishing"
					? "Entrenamiento por subir"
					: "Entrenamiento en curso"}
			</span>
			<span className='underline underline-offset-4'>Volver</span>
		</Link>
	);
}
