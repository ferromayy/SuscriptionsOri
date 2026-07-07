import Link from "next/link";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; tenant?: string }>;
}) {
  const { email, tenant } = await searchParams;
  const isSubscriberFlow = Boolean(tenant);

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell text-center">
        <h1 className="text-2xl font-semibold">Revisá tu correo</h1>
        <p className="mt-4 text-gray-600">
          Enviamos un código de 6 dígitos
          {email ? (
            <>
              {" "}
              a <strong className="text-gray-800">{email}</strong>
            </>
          ) : (
            " a tu email"
          )}
          . Ingresalo para{" "}
          {isSubscriberFlow
            ? "activar tu suscripción."
            : "activar tu cuenta y tu organización."}
        </p>
        {email && (
          <Link
            href={`/auth/verify-email?email=${encodeURIComponent(email)}${tenant ? `&tenant=${encodeURIComponent(tenant)}` : ""}`}
            className="mt-6 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ingresar código
          </Link>
        )}
        <p className="mt-2 text-sm text-gray-500">
          Revisá también la carpeta de spam.
        </p>

        {email && (
          <div className="mt-8 text-left">
            <ResendVerificationForm email={email} />
          </div>
        )}

        <Link
          href="/auth/login"
          className="mt-8 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          Ya verifiqué → Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
