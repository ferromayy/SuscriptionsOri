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
    <div className="min-h-full bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Super Admin
            </p>
            <p className="text-sm text-slate-300">{title}</p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-slate-400 hover:text-slate-200">
              Inicio
            </Link>
            <Link
              href="/admin/tenants"
              className="text-slate-400 hover:text-slate-200"
            >
              Tenants
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-slate-400 hover:text-slate-200"
              >
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {description && (
          <p className="mt-2 text-slate-400">{description}</p>
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
