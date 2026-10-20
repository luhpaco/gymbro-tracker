"use client";

import { Check, Flame, Trash2 } from "lucide-react";
import type { LiveSet } from "@/lib/live-session";
import { setSchema } from "@/lib/schemas/workout-set";
import { cn } from "@/lib/utils";
import { EditableStat } from "../../ui/editable-stat";

const validateWeight = (n: number): string | null => {
	const result = setSchema.shape.weight.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

const validateReps = (n: number): string | null => {
	const result = setSchema.shape.reps.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

interface LiveSetRowProps {
	set: LiveSet;
	number: number;
	exerciseName: string;
	onChange: (patch: Partial<Pick<LiveSet, "weight" | "reps">>) => void;
	onToggleWarmup: () => void;
	onToggleDone: () => void;
	onRemove: () => void;
}

// Expands the tap area to 44px without changing the layout.
const STAT_HIT_AREA =
	"relative after:absolute after:-inset-x-2 after:-inset-y-[10px] after:content-['']";

// A comma stays legible in the marker face where a period can read as "102.5" -> "1025".
const formatWeight = (value: number): string => String(value).replace(".", ",");

const iconButton =
	"inline-flex shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40";

export const LiveSetRow = ({
	set,
	number,
	exerciseName,
	onChange,
	onToggleWarmup,
	onToggleDone,
	onRemove,
}: LiveSetRowProps) => {
	const done = set.doneAt !== null;
	const valid = setSchema.safeParse(set).success;
	const context = `serie ${number}, ${exerciseName}`;

	return (
		<li
			className={cn(
				"grid grid-cols-[2ch_1fr_1fr_auto_auto_auto] items-center gap-2 border-b border-dashed border-muted-foreground/30 py-2 last:border-b-0",
				done && "bg-primary/10",
			)}
		>
			<span className='font-hand text-center tabular-nums'>{number}</span>
			<EditableStat
				value={set.weight}
				label={`Peso, ${context}`}
				unit='kg'
				width='5ch'
				className={STAT_HIT_AREA}
				format={formatWeight}
				onCommit={(next) => onChange({ weight: next })}
				validate={validateWeight}
			/>
			<EditableStat
				value={set.reps}
				label={`Repeticiones, ${context}`}
				width='3ch'
				className={STAT_HIT_AREA}
				onCommit={(next) => onChange({ reps: next })}
				validate={validateReps}
			/>
			<button
				type='button'
				aria-pressed={set.isWarmup}
				aria-label={`Calentamiento, ${context}`}
				title='Calentamiento'
				onClick={onToggleWarmup}
				className={cn(
					iconButton,
					"h-11 w-11",
					set.isWarmup
						? "border-primary bg-primary text-primary-foreground"
						: "border-border text-muted-foreground hover:bg-accent",
				)}
			>
				<Flame size={18} aria-hidden />
			</button>
			<button
				type='button'
				aria-pressed={done}
				aria-label={
					done ? `Deshacer ${context}` : `Marcar como hecha, ${context}`
				}
				title={
					done || valid
						? undefined
						: "Completa peso y repeticiones para marcarla"
				}
				disabled={!done && !valid}
				onClick={onToggleDone}
				className={cn(
					iconButton,
					"h-11 w-11",
					done
						? "border-primary bg-primary text-primary-foreground"
						: valid
							? "border-card-foreground/60 text-card-foreground hover:bg-accent"
							: "border-dashed border-muted-foreground text-muted-foreground disabled:opacity-100",
				)}
			>
				<Check size={20} aria-hidden />
			</button>
			<button
				type='button'
				aria-label={`Eliminar ${context}`}
				onClick={onRemove}
				className={cn(
					iconButton,
					"h-11 w-9 border-transparent text-destructive hover:bg-accent",
				)}
			>
				<Trash2 size={16} aria-hidden />
			</button>
		</li>
	);
};
