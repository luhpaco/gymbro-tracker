"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteWorkout } from "@/actions/workout/delete-workout";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

import {
	DELETE_WORKOUT_SUCCESS_HREF,
	beginDeleteRequest,
	failDeleteRequest,
	getDeleteFailureMessage,
	initialDeleteSheetState,
	resolveDeleteIntent,
	type DeleteSheetState,
} from "./workout-delete-confirmation.logic";

export interface WorkoutDeleteConfirmationProps {
	workoutId: string;
	workoutName: string;
}

/**
 * Whole-workout deletion sheet.
 *
 * Irreversible, so it is staggered from set/exercise removal: the sheet only
 * ever deletes through its explicit confirm button. Opening, overlay click,
 * Escape, the close icon and Cancel are all guarded and never call the action,
 * and every dismissal plus a repeat confirmation is ignored while a request is
 * in flight. A failed request keeps the sheet and the owner's context so the
 * coded failure stays readable next to the workout it belongs to.
 */
export const WorkoutDeleteConfirmation = ({
	workoutId,
	workoutName,
}: WorkoutDeleteConfirmationProps) => {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [state, setState] = useState<DeleteSheetState>(initialDeleteSheetState);

	const handleConfirm = async () => {
		if (resolveDeleteIntent("confirm", state.isPending) !== "delete") return;

		setState(beginDeleteRequest());
		const result = await deleteWorkout({ workoutId });

		if (result.ok) {
			setState(initialDeleteSheetState);
			setIsOpen(false);
			// The detail route no longer resolves once the delete commits, so
			// navigate to the list instead of refreshing a missing page.
			router.push(DELETE_WORKOUT_SUCCESS_HREF);
			return;
		}

		setState(failDeleteRequest(result.code));
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen) {
			if (resolveDeleteIntent("open", state.isPending) === "open") {
				setState(initialDeleteSheetState);
				setIsOpen(true);
			}
			return;
		}

		// Overlay click, Escape, the close icon and Cancel all converge here.
		if (resolveDeleteIntent("cancel", state.isPending) === "dismiss") {
			setIsOpen(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<Button type='button' variant='destructive' className='min-h-11 w-full'>
					<Trash2 className='mr-2 h-5 w-5' aria-hidden />
					Eliminar entrenamiento
				</Button>
			</DialogTrigger>
			<DialogContent
				className='inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-xl border-border bg-secondary px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-t-xl'
				onEscapeKeyDown={(event) => {
					if (resolveDeleteIntent("escape", state.isPending) === "noop") {
						event.preventDefault();
					}
				}}
				onPointerDownOutside={(event) => {
					if (resolveDeleteIntent("overlay", state.isPending) === "noop") {
						event.preventDefault();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>Eliminar entrenamiento</DialogTitle>
					<DialogDescription>
						Se eliminarán «{workoutName}» y todas sus series de forma
						permanente. Esta acción no se puede deshacer.
					</DialogDescription>
				</DialogHeader>

				{state.failure && (
					<p role='alert' className='text-sm text-destructive'>
						{getDeleteFailureMessage(state.failure)}
					</p>
				)}

				<div className='flex flex-col gap-2'>
					<Button
						type='button'
						variant='destructive'
						className='min-h-11 w-full'
						disabled={state.isPending}
						onClick={handleConfirm}
					>
						{state.isPending ? "Eliminando…" : "Eliminar definitivamente"}
					</Button>
					<DialogClose asChild>
						<Button
							type='button'
							variant='outline'
							className='min-h-11 w-full'
							disabled={state.isPending}
						>
							Cancelar
						</Button>
					</DialogClose>
				</div>
			</DialogContent>
		</Dialog>
	);
};
