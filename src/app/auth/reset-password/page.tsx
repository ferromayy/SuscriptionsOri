import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { validatePasswordResetToken } from "@/lib/auth/password-reset";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const { token, next } = await searchParams;
  const safeNext = next?.startsWith("/") ? next : undefined;

  if (!token) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-full ori-form-shell text-center">
          <h1 className="ori-title text-2xl">Link inválido</h1>
          <p className="ori-subtitle mt-4">
            Abrí el link que te enviamos por email o pedí uno nuevo.
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-6 inline-block ori-btn-primary px-6 py-2"
          >
            Pedir nuevo link
          </Link>
        </div>
      </div>
    );
  }

  const validation = await validatePasswordResetToken(token);

  if (!validation.ok) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-16">
        <div className="w-full ori-form-shell text-center">
          <h1 className="ori-title text-2xl">No se pudo usar el link</h1>
          <p className="mt-4 text-sm text-red-600" role="alert">
            {validation.error}
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-6 inline-block ori-btn-primary px-6 py-2"
          >
            Pedir nuevo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <h1 className="ori-title text-2xl">Nueva contraseña</h1>
        <p className="ori-subtitle mt-2">
          Elegí una contraseña nueva para{" "}
          <strong className="text-gray-800">{validation.email}</strong>.
        </p>
        <ResetPasswordForm token={token} next={safeNext} />
      </div>
    </div>
  );
}
