import Link from "next/link";

import { FindJoinForm } from "@/components/join/find-join-form";

export default function FindJoinPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <h1 className="text-2xl font-semibold">Registrarme como suscriptor</h1>
        <p className="mt-2 text-sm text-gray-600">
          Cada organización tiene su portal. Ingresá el código de la
          organización para ir a su página de registro.
        </p>
        <FindJoinForm />
        <div className="mt-6 space-y-2 border-t border-gray-200 pt-6 text-sm">
          <p className="text-gray-500">¿Ya tenés cuenta?</p>
          <Link
            href="/auth/login"
            className="text-gray-700 hover:text-gray-600"
          >
            Iniciar sesión →
          </Link>
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
