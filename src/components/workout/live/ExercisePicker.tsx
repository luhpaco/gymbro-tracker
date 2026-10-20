"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "../../ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

interface ExercisePickerProps {
	exercises: ReadonlyArray<{ id: string; name: string }>;
	onPick: (exerciseId: string, exerciseName: string) => void;
}

export const ExercisePicker = ({ exercises, onPick }: ExercisePickerProps) => {
	const [open, setOpen] = useState(false);

	if (exercises.length === 0) {
		return (
			<p className='text-center text-xs text-muted-foreground'>
				Aún no tienes ejercicios.{" "}
				<Link
					href='/exercises/create'
					className='text-primary underline underline-offset-4'
				>
					Crea uno para empezar.
				</Link>
			</p>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type='button'
					variant='outline'
					className='h-12 w-full justify-center gap-2'
				>
					<Plus size={18} aria-hidden />
					Agregar ejercicio
				</Button>
			</PopoverTrigger>
			<PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
				<Command>
					<CommandInput placeholder='Busca un ejercicio...' />
					<CommandEmpty>No se encontró tu ejercicio.</CommandEmpty>
					<CommandGroup>
						<CommandList>
							{exercises.map((exercise) => (
								<CommandItem
									key={exercise.id}
									value={exercise.name}
									className='min-h-11'
									onSelect={() => {
										onPick(exercise.id, exercise.name);
										setOpen(false);
									}}
								>
									<span className='truncate'>{exercise.name}</span>
								</CommandItem>
							))}
						</CommandList>
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
};
