import { TornStrip } from "@/components/ui/torn-strip";
import { LoginForm } from "./ui/LoginForm";
import Link from "next/link";

export default function LoginPage() {
	return (
		<TornStrip className='w-full flex flex-col gap-8 text-sm'>
			<TornStrip.Header title='Inicio de sesión' className='items-center' />
			<TornStrip.Body>
				<LoginForm />
				<p className='mt-4 text-center'>
					<span className='text-muted-foreground me-2'>
						¿No tienes una cuenta?
					</span>
					<Link href='/auth/register' className='hover:underline font-semibold'>
						Registrate aquí.
					</Link>
				</p>
			</TornStrip.Body>
		</TornStrip>
	);
}
