import Link from "next/link";

import { logoutAction } from "@/app/auth/actions";
import { requirePlatformAdmin } from "@/lib/auth/require-admin";

export function AdminShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="min-h-full bg-white text-gray-900">
      <header className="ori-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <p className="ori-eyebrow">Super Admin</p>
            <p className="text-sm font-medium text-gray-900">{title}</p>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="ori-nav-link">
              Inicio
            </Link>
            <Link href="/admin/tenants" className="ori-nav-link">
              Tenants
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="ori-nav-link">
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="ori-title">{title}</h1>
        {description && (
          <p className="mt-2 text-gray-600">{description}</p>
        )}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

export async function AdminPageWrapper({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();
  return (
    <AdminShell title={title} description={description}>
      {children}
    </AdminShell>
  );
}
