import { cn } from "@/lib/utils";

/**
 * Marker-face numeral in a reserved character box.
 *
 * Permanent Marker has no tabular figures, so digits of differing widths jitter.
 * Reserving a fixed `ch` box (plus `tabular-nums`) stops `5 → 100` from widening
 * its row — the width never depends on the value.
 */

const widthClasses = {
	"2ch": "w-[2ch]",
	"3ch": "w-[3ch]",
	"4ch": "w-[4ch]",
} as const;

export interface StatProps {
	value: number | string;
	width?: keyof typeof widthClasses;
	className?: string;
}

export const Stat = ({ value, width = "4ch", className }: StatProps) => {
	return (
		<span
			className={cn(
				"inline-block font-hand text-center tabular-nums",
				widthClasses[width],
				className
			)}
		>
			{value}
		</span>
	);
};
