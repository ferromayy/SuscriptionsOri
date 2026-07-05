import Link from "next/link";

import { VerifyCodeForm } from "@/components/auth/verify-code-form";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  if (!email) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <h1 className="text-2xl font-semibold">Verificar email</h1>
          <p className="mt-4 text-slate-400">
            Abrí el link que te llegó al correo o ingresá tu email abajo.
          </p>
          <div className="mt-6 text-left">
            <ResendVerificationForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-semibold">Verificá tu email</h1>
        <p className="mt-4 text-slate-400">
          Ingresá el código de 6 dígitos que enviamos a{" "}
          <strong className="text-slate-200">{email}</strong>. Al confirmarlo se
          activará tu organización.
        </p>
        <VerifyCodeForm email={email} />
        <div className="mt-6 border-t border-slate-800 pt-6">
          <p className="text-xs text-slate-500">¿No llegó el código?</p>
          <div className="mt-2">
            <ResendVerificationForm email={email} />
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-slate-400 hover:text-slate-200"
        >
          ← Inicio
        </Link>
      </div>
    </div>
  );
}
