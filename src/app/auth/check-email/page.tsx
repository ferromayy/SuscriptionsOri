import Link from "next/link";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <h1 className="text-2xl font-semibold">Revisá tu correo</h1>
        <p className="mt-4 text-slate-400">
          Enviamos un código de 6 dígitos
          {email ? (
            <>
              {" "}
              a <strong className="text-slate-200">{email}</strong>
            </>
          ) : (
            " a tu email"
          )}
          . Ingresalo para activar tu cuenta y tu organización.
        </p>
        {email && (
          <Link
            href={`/auth/verify-email?email=${encodeURIComponent(email)}`}
            className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
          >
            Ingresar código
          </Link>
        )}
        <p className="mt-2 text-sm text-slate-500">
          Revisá también la carpeta de spam.
        </p>

        {email && (
          <div className="mt-8 text-left">
            <ResendVerificationForm email={email} />
          </div>
        )}

        <Link
          href="/auth/login"
          className="mt-8 inline-block text-sm text-slate-400 hover:text-slate-200"
        >
          Ya verifiqué → Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
