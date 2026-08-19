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
