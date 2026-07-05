import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default function AuthLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-400">
          Para clientes y suscriptos que ya tienen cuenta.
        </p>
        <LoginForm searchParams={searchParams} />
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-slate-400 hover:text-slate-200"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
