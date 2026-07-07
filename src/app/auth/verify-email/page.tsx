import Link from "next/link";

import { VerifyCodeForm } from "@/components/auth/verify-code-form";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; tenant?: string }>;
}) {
  const { email, tenant } = await searchParams;
  const isSubscriberFlow = Boolean(tenant);

  if (!email) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-full ori-form-shell text-center">
          <h1 className="text-2xl font-semibold">Verificar email</h1>
          <p className="mt-4 text-gray-600">
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
      <div className="w-full ori-form-shell">
        <h1 className="text-2xl font-semibold">Verificá tu email</h1>
        <p className="mt-4 text-gray-600">
          Ingresá el código de 6 dígitos que enviamos a{" "}
          <strong className="text-gray-800">{email}</strong>. Al confirmarlo{" "}
          {isSubscriberFlow
            ? "activaremos tu suscripción."
            : "se activará tu organización."}
        </p>
        <VerifyCodeForm email={email} />
        <div className="mt-6 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">¿No llegó el código?</p>
          <div className="mt-2">
            <ResendVerificationForm email={email} />
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Inicio
        </Link>
      </div>
    </div>
  );
}
