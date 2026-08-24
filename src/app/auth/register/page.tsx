import { TornStrip } from "@/components/ui/torn-strip";
import { RegisterForm } from "./ui/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
	return (
		<TornStrip className='w-full flex flex-col gap-8 text-sm'>
			<TornStrip.Header title='Crea una cuenta' className='items-center' />
			<TornStrip.Body>
				<RegisterForm />
				<p className='mt-4 text-center'>
					<span className='text-muted-foreground me-2'>
						¿Ya tienes una cuenta?
					</span>
					<Link href='/auth/login' className='hover:underline font-semibold'>
						Inicia sesión aquí.
					</Link>
				</p>
			</TornStrip.Body>
		</TornStrip>
	);
}
