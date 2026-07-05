import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/auth/actions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantRole, isTenantManager } from "@/lib/auth/permissions";
import { createDbClient } from "@/lib/db/client";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth/login?next=/app/${tenantSlug}`);
  }

  const db = createDbClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug, status")
    .eq("slug", tenantSlug)
    .maybeSingle();

  if (!tenant) {
    redirect("/");
  }

  const role = await getTenantRole(user.id, tenant.id);
  if (!role) {
    redirect("/");
  }

  const { count: memberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber");

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-slate-400">
        {tenant.name}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Panel del cliente</h1>
      <p className="mt-2 text-slate-400">
        Sesión: {user.email} · Rol: {role}
      </p>

      {isTenantManager(role) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm text-slate-400">Estado del tenant</p>
            <p className="mt-2 text-xl font-semibold capitalize">{tenant.status}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <p className="text-sm text-slate-400">Suscriptos</p>
            <p className="mt-2 text-3xl font-semibold">{memberCount ?? 0}</p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Inicio
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
