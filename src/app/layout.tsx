import type { Metadata } from "next";
import { Inter as FontSans, Anton, Permanent_Marker } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/providers";
import { Toaster } from "@/components/ui/toaster";
import MaintenancePage from "./maintenance/page";

const fontSans = FontSans({
	subsets: ["latin"],
	variable: "--font-sans",
});

const fontDisplay = Anton({
	subsets: ["latin"],
	weight: "400",
	variable: "--font-display",
});

const fontHand = Permanent_Marker({
	subsets: ["latin"],
	weight: "400",
	variable: "--font-hand",
});

const DIRECTION_CONTRACT = `<!--
THESIS: Gymbro Tracker reads as gear taped onto you before you lift, not software you fill out — logging a set means tearing a strip and writing the number down.
OWN-WORLD: Matte charcoal-black ground, chalk-white torn strips, one signal-red accent for state and action. Anton for display, wordmarks and labels; Permanent Marker for handwritten numerals only (weight, reps, timers); Inter for body copy. Near-zero border radius — tape doesn't round its corners.
STORY: Mid-set, the lifter glances at the screen, sees today's strips at a glance, taps to tear a new one, and the number they scrawl reads clearly under gym light without hunting through menus.
FIRST VIEWPORT: Today's session as a stack of torn tape strips — exercise name in Anton caps, weight/reps in Permanent Marker, a red set-tag corner per strip, primary action rendered as a torn red strip CTA.
FORM: Athletic Tape & Wrap, candidate 7 of 7 on the grounded list, seed key 20c9228e.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
-->`;

export const metadata: Metadata = {
	title: "GymbroTracker",
	description:
		"Aplicación donde puedes registrar cada uno de tus entrenamientos y ejercicios realizados en el gimnasio.",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const isMaintenance = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

	return (
		<html lang='en'>
			<body
				className={cn(
					"min-h-screen bg-background font-sans antialiased",
					fontSans.variable,
					fontDisplay.variable,
					fontHand.variable
				)}
			>
				<div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
				{isMaintenance ? (
					<MaintenancePage />
				) : (
					<AuthProvider>{children}</AuthProvider>
				)}
				<Toaster />
			</body>
		</html>
	);
}
