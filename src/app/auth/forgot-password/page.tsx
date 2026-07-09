import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : undefined;

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <h1 className="ori-title text-2xl">¿Olvidaste tu contraseña?</h1>
        <p className="ori-subtitle mt-2">
          Ingresá el email de tu cuenta (suscriptor o dueño de organización).
          Te enviaremos un link para elegir una contraseña nueva.
        </p>
        <ForgotPasswordForm next={safeNext} />
        <Link
          href={safeNext ? `/auth/login?next=${encodeURIComponent(safeNext)}` : "/auth/login"}
          className="mt-6 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
