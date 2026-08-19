"use client";

import { updateSet } from "@/actions/workout/update-set";
import { DataItem } from "@/interfaces";

import { EditableStat } from "../ui/editable-stat";
import { Stat } from "../ui/stat";
import { setSchema } from "./AddExerciseForm";

const validateWeight = (n: number): string | null => {
	const result = setSchema.shape.weight.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

const validateReps = (n: number): string | null => {
	const result = setSchema.shape.reps.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

interface Props {
	exerciseName: string;
	sets: DataItem[];
}

export const WorkoutDetailSets = ({ exerciseName, sets }: Props) => {
	return (
		<ol className='flex flex-col gap-2'>
			{sets.map((set, index) => (
				<li
					key={set.id}
					className='flex items-center justify-between gap-4'
				>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>
							Serie
						</span>
						<Stat value={index + 1} width='2ch' />
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>
							Peso
						</span>
						<EditableStat
							value={set.weight}
							label={`Peso, serie ${index + 1}, ${exerciseName}`}
							unit='kg'
							width='4ch'
							onCommit={(next) =>
								updateSet({ id: set.id, weight: next })
							}
							validate={validateWeight}
						/>
					</div>
					<div className='flex items-baseline gap-2'>
						<span className='text-xs text-muted-foreground'>
							Reps
						</span>
						<EditableStat
							value={set.reps}
							label={`Repeticiones, serie ${index + 1}, ${exerciseName}`}
							width='4ch'
							onCommit={(next) =>
								updateSet({ id: set.id, reps: next })
							}
							validate={validateReps}
						/>
					</div>
				</li>
			))}
		</ol>
	);
};
