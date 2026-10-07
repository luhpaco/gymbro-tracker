"use client";

import { Check, Trash2, X } from "lucide-react";

import { updateSet } from "@/actions/workout/update-set";
import { Button } from "@/components/ui/button";
import { DataItem } from "@/interfaces";
import { setSchema } from "@/lib/schemas/workout-set";

import { EditableStat } from "../ui/editable-stat";
import { Stat } from "../ui/stat";

const validateWeight = (n: number): string | null => {
	const result = setSchema.shape.weight.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

const validateReps = (n: number): string | null => {
	const result = setSchema.shape.reps.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

/**
 * Set-level removal wiring owned by `WorkoutDetailControls`.
 *
 * The rows stay presentational: the two-tap confirmation state and the action
 * call live in the parent so a single pending confirmation is shared across the
 * workout. When this is omitted the list renders as a read-only display and
 * retains the existing `EditableStat` behavior either way.
 */
export interface SetRemovalControls {
	pendingId: string | null;
	submittingId: string | null;
	onRequestRemove: (setId: string) => void;
	onConfirmRemove: (setId: string) => void;
	onCancelRemove: () => void;
}

interface Props {
	exerciseName: string;
	sets: DataItem[];
	removal?: SetRemovalControls;
}

export const WorkoutDetailSets = ({ exerciseName, sets, removal }: Props) => {
	return (
		<ol className='flex flex-col gap-2'>
			{sets.map((set, index) => (
				<li key={set.id} className='flex items-center justify-between gap-4'>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>Serie</span>
						<Stat value={index + 1} width='2ch' />
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>Peso</span>
						<EditableStat
							value={set.weight}
							label={`Peso, serie ${index + 1}, ${exerciseName}`}
							unit='kg'
							width='4ch'
							onCommit={(next) => updateSet({ id: set.id, weight: next })}
							validate={validateWeight}
						/>
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>Reps</span>
						<EditableStat
							value={set.reps}
							label={`Repeticiones, serie ${index + 1}, ${exerciseName}`}
							width='4ch'
							onCommit={(next) => updateSet({ id: set.id, reps: next })}
							validate={validateReps}
						/>
					</div>
					{removal &&
						(removal.pendingId === set.id ? (
							<div className='flex shrink-0 items-center gap-2'>
								<span className='text-sm text-muted-foreground'>
									¿Eliminar?
								</span>
								<Button
									type='button'
									size='icon'
									variant='destructive'
									aria-label={`Confirmar eliminar serie ${index + 1} de ${exerciseName}`}
									disabled={removal.submittingId === set.id}
									onClick={() => removal.onConfirmRemove(set.id)}
									className='min-h-11 min-w-11'
								>
									<Check className='h-5 w-5' />
								</Button>
								<Button
									type='button'
									size='icon'
									variant='outline'
									aria-label={`Cancelar eliminar serie ${index + 1} de ${exerciseName}`}
									onClick={removal.onCancelRemove}
									className='min-h-11 min-w-11'
								>
									<X className='h-5 w-5' />
								</Button>
							</div>
						) : (
							<Button
								type='button'
								size='icon'
								variant='ghost'
								aria-label={`Eliminar serie ${index + 1} de ${exerciseName}`}
								onClick={() => removal.onRequestRemove(set.id)}
								className='min-h-11 min-w-11 text-destructive'
							>
								<Trash2 className='h-5 w-5' />
							</Button>
						))}
				</li>
			))}
		</ol>
	);
};
