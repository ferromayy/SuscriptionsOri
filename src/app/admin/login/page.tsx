import Link from "next/link";

import { AdminLoginForm } from "@/components/auth/admin-login-form";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
          Plataforma
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Super Admin</h1>
        <p className="mt-2 text-sm text-slate-400">
          Auth propio. El usuario se crea desde{" "}
          <code className="text-slate-300">SUPER_ADMIN_EMAIL</code> y{" "}
          <code className="text-slate-300">SUPER_ADMIN_PASSWORD</code> en{" "}
          <code className="text-slate-300">.env.local</code>.
        </p>
        <AdminLoginForm searchParams={searchParams} />
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
