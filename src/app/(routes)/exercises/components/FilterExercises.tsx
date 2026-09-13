"use client";
import { zodResolver } from "@hookform/resolvers/zod";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@/components/ui/form";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useExercisesStore } from "@/store";
import { MuscleGroup } from "@prisma/client";
const FormSchema = z.object({
	muscleGroup: z.string({
		required_error: "Por favor selecciona un grupo muscular",
	}),
});

interface Props {
	muscleGroups: MuscleGroup[];
}

export const FilterExercises = ({ muscleGroups }: Props) => {
	const form = useForm<z.infer<typeof FormSchema>>({
		resolver: zodResolver(FormSchema),
	});
	const { filterExercises } = useExercisesStore();
	const onSubmit = (data: z.infer<typeof FormSchema>) => {
		const { muscleGroup } = data;
		filterExercises(muscleGroup);
	};
	return (
		<Form {...form}>
			<form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name='muscleGroup'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Grupo muscular</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder='Selecciona un grupo muscular' />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value='all'>Todos</SelectItem>
									{muscleGroups.map((muscle) => (
										<SelectItem key={muscle.id} value={muscle.tag}>
											{muscle.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</FormItem>
					)}
				/>
				<Button type='submit'>Filtrar</Button>
			</form>
		</Form>
	);
};
