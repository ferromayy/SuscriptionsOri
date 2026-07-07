import Link from "next/link";

import { AdminPageWrapper } from "@/components/admin/admin-shell";
import { createDbClient } from "@/lib/db/client";

export default async function AdminDashboardPage() {
  const db = createDbClient();

  const { count: tenantCount } = await db
    .from("tenants")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await db
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_owner");

  return (
    <AdminPageWrapper
      title="Panel de plataforma"
      description="Gestioná clientes (tenants) e invitaciones."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Total tenants</p>
          <p className="mt-2 text-3xl font-semibold">{tenantCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Invitaciones pendientes</p>
          <p className="mt-2 text-3xl font-semibold">{pendingCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/tenants/new"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Invitar nuevo cliente
        </Link>
        <Link
          href="/admin/tenants"
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:border-gray-400"
        >
          Ver tenants
        </Link>
      </div>
    </AdminPageWrapper>
  );
}
