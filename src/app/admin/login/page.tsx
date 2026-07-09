import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/auth/permissions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user && (await isPlatformAdmin(user.id))) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-16">
      <div className="w-full ori-form-shell">
        <p className="text-sm font-medium uppercase tracking-widest text-gray-600">
          Plataforma
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Super Admin</h1>
        <p className="mt-2 text-sm text-gray-600">
          Auth propio. El usuario se crea desde{" "}
          <code className="text-gray-700">SUPER_ADMIN_EMAIL</code> y{" "}
          <code className="text-gray-700">SUPER_ADMIN_PASSWORD</code> en{" "}
          <code className="text-gray-700">.env.local</code>.
        </p>
        <AdminLoginForm searchParams={searchParams} />
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
