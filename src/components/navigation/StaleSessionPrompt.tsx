"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useLiveSessionStore } from "@/store";

// A session left open for more than 12 hours is probably forgotten, so on return the
// user decides whether to finish or discard it. Dismissed per page load.
export function StaleSessionPrompt() {
	const router = useRouter();
	const hydrated = useLiveSessionStore((store) => store.hydrated);
	const status = useLiveSessionStore((store) => store.state.status);
	const isStale = useLiveSessionStore((store) => store.isStale);
	const discard = useLiveSessionStore((store) => store.discard);
	const [dismissed, setDismissed] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (hydrated && !dismissed && status === "active" && isStale()) {
			setOpen(true);
		}
	}, [hydrated, dismissed, status, isStale]);

	const close = () => {
		setDismissed(true);
		setOpen(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => (next ? setOpen(true) : close())}
		>
			<DialogContent className='inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-xl border-border bg-secondary px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-t-xl'>
				<DialogHeader>
					<DialogTitle>Tienes un entrenamiento abierto</DialogTitle>
					<DialogDescription>
						Lleva más de 12 horas sin terminar. ¿Quieres terminarlo o
						descartarlo?
					</DialogDescription>
				</DialogHeader>
				<div className='mt-2 flex flex-col gap-2'>
					<Button
						className='h-12'
						onClick={() => {
							close();
							router.push("/workouts/live");
						}}
					>
						Terminarlo
					</Button>
					<Button
						variant='destructive'
						className='h-12'
						onClick={() => {
							discard();
							close();
						}}
					>
						Descartarlo
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
