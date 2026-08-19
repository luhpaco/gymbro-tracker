"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tap-to-edit numeral (weight/reps/set) in the same reserved box.
 *
 * Display mode is a native `<button type="button">` (free Enter/Space + focus
 * a11y) showing the marker-face numeral with a dashed "write here" underline.
 * Tapping swaps in an `<input type="number" inputMode="numeric">` of identical
 * width, autofocused and pre-selected so one tap overwrites. Commit on blur or
 * Enter; Escape cancels. `validate` is injected by the caller (reusing the
 * existing `setSchema`), never duplicated here. Invalid input stays in edit
 * mode with `aria-invalid` and a red tape underline — no commit.
 */

const widthClasses = {
	"2ch": "w-[2ch]",
	"3ch": "w-[3ch]",
	"4ch": "w-[4ch]",
} as const;

export interface EditableStatProps {
	value: number;
	label: string;
	unit?: string;
	width?: keyof typeof widthClasses;
	onCommit: (next: number) => void;
	validate?: (n: number) => string | null;
	disabled?: boolean;
}

export const EditableStat = ({
	value,
	label,
	unit,
	width = "4ch",
	onCommit,
	validate,
	disabled = false,
}: EditableStatProps) => {
	const [editing, setEditing] = React.useState(false);
	const [draft, setDraft] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const inputRef = React.useRef<HTMLInputElement>(null);
	/** Guards the blur fired when the input unmounts after commit/cancel. */
	const finishedRef = React.useRef(false);

	React.useEffect(() => {
		if (editing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [editing]);

	const startEditing = () => {
		finishedRef.current = false;
		setDraft(String(value));
		setError(null);
		setEditing(true);
	};

	const commit = () => {
		if (finishedRef.current) return;

		const parsed = Number(draft);
		if (draft.trim() === "" || Number.isNaN(parsed)) {
			setError("Valor inválido");
			return;
		}
		if (validate) {
			const message = validate(parsed);
			if (message) {
				setError(message);
				return;
			}
		}

		finishedRef.current = true;
		setEditing(false);
		setError(null);
		onCommit(parsed);
	};

	const cancel = () => {
		if (finishedRef.current) return;
		finishedRef.current = true;
		setEditing(false);
		setError(null);
	};

	if (!editing) {
		return (
			<span className='inline-flex items-baseline'>
				<button
					type='button'
					disabled={disabled}
					aria-label={label}
					title={label}
					onClick={startEditing}
					className={cn(
						"cursor-pointer bg-transparent border-0 border-b-2 border-dashed border-muted-foreground/50 p-0 text-center font-hand tabular-nums text-inherit underline-offset-4",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
						"disabled:pointer-events-none disabled:opacity-50",
						widthClasses[width]
					)}
				>
					{value}
				</button>
				{unit ? (
					<span className='ml-1 font-sans text-xs'>{unit}</span>
				) : null}
			</span>
		);
	}

	return (
		<span className='inline-flex items-baseline'>
			<input
				ref={inputRef}
				type='number'
				inputMode='numeric'
				value={draft}
				aria-label={label}
				aria-invalid={error ? true : undefined}
				title={error ?? label}
				onChange={(e) => {
					setDraft(e.target.value);
					setError(null);
				}}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						commit();
					} else if (e.key === "Escape") {
						e.preventDefault();
						cancel();
					}
				}}
				className={cn(
					"bg-transparent border-0 border-b-2 border-solid px-0 text-center font-hand tabular-nums text-inherit",
					"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]",
					error
						? "border-destructive text-destructive"
						: "border-primary",
					widthClasses[width]
				)}
			/>
			{unit ? <span className='ml-1 font-sans text-xs'>{unit}</span> : null}
		</span>
	);
};
