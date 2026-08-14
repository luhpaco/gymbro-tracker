import { TornStrip } from "./ui/torn-strip";

interface ResumeCardProps {
	children: React.ReactNode;
}

/**
 * Transitional adapter over the `TornStrip` primitive.
 *
 * Keeps the exact `Header`/`Body`/`Link` compound API its six consumers rely on
 * (dashboard ×2, `ExerciseSection`, `WorkoutsSection`, login, register), so the
 * whole app re-skins in one diff with zero consumer churn. This file is deleted
 * in the final slice once every consumer imports `TornStrip` directly.
 */
export const ResumeCard = ({ children }: ResumeCardProps) => {
	return (
		<TornStrip className='w-full flex flex-col gap-8 text-sm'>
			{children}
		</TornStrip>
	);
};

ResumeCard.Header = TornStrip.Header;
ResumeCard.Body = TornStrip.Body;
ResumeCard.Link = TornStrip.Link;
