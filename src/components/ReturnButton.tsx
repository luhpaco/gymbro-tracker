"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Undo2 } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "./ui/button";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

interface Props {
	children: React.ReactNode;
	variant?: ButtonVariant;
	fallbackHref: string;
}

export const ReturnButton = ({ children, variant, fallbackHref }: Props) => {
	const router = useRouter();
	return (
		<Button
			type='button'
			variant={variant}
			className='flex items-center gap-2'
			onClick={() => {
				const hasHistory =
					typeof window !== "undefined" && window.history.length > 1;

				if (hasHistory) {
					router.back();
				} else {
					router.push(fallbackHref);
				}
			}}
		>
			<Undo2 />
			{children}
		</Button>
	);
};
