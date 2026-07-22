import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default function AuthLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <h1 className="text-2xl font-semibold">Acceso de organización</h1>
        <p className="mt-2 text-sm text-gray-600">
          Para dueños y administradores del comercio. Si sos suscriptor, ingresá
          desde el link de tu suscripción.
        </p>
        <LoginForm searchParams={searchParams} audience="manager" />
        <div className="mt-6 rounded-lg border border-gray-200 bg-white/50 px-4 py-3 text-sm text-gray-600">
          <p className="font-medium text-gray-800">¿Sos suscriptor?</p>
          <p className="mt-1">
            No uses esta pantalla. Abrí el link de suscripciones de tu comercio
            o buscalo acá:
          </p>
          <Link
            href="/join"
            className="mt-2 inline-block font-medium text-gray-900 hover:text-gray-900"
          >
            Encontrar mi suscripción →
          </Link>
        </div>
        <div className="mt-6 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">
            ¿Olvidaste tu contraseña?{" "}
            <Link
              href="/auth/forgot-password"
              className="font-medium text-gray-700 hover:text-gray-900"
            >
              Recuperarla por email
            </Link>
          </p>
        </div>
        <div className="mt-6 border-t border-gray-200 pt-6">
          <p className="text-xs text-gray-500">
            ¿No llegó el email de verificación?
          </p>
          <div className="mt-2">
            <ResendVerificationForm />
          </div>
        </div>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-gray-600 hover:text-gray-800"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
