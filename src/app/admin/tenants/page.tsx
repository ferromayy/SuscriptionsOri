import Link from "next/link";

import { AdminPageWrapper } from "@/components/admin/admin-shell";
import { TenantRowActions } from "@/components/admin/tenant-row-actions";
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge";
import { createDbClient } from "@/lib/db/client";

export default async function TenantsListPage() {
  const db = createDbClient();

  const { data: tenants } = await db
    .from("tenants")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  const { data: invitations } = await db
    .from("platform_invitations")
    .select("tenant_id, email, status, expires_at")
    .eq("status", "pending");

  const inviteByTenant = new Map(
    (invitations ?? []).map((inv) => [inv.tenant_id, inv]),
  );

  return (
    <AdminPageWrapper
      title="Tenants"
      description="Organizaciones de clientes en la plataforma."
    >
      <div className="mb-6">
        <Link
          href="/admin/tenants/new"
          className="inline-flex rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950"
        >
          + Nuevo cliente
        </Link>
      </div>

      {(!tenants || tenants.length === 0) && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
          No hay tenants todavía.{" "}
          <Link href="/admin/tenants/new" className="text-slate-200 underline">
            Creá el primero
          </Link>
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Organización</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Invitación</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const invite = inviteByTenant.get(tenant.id);
                return (
                  <tr
                    key={tenant.id}
                    className="border-b border-slate-800/80 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{tenant.name}</td>
                    <td className="px-4 py-3 text-slate-400">{tenant.slug}</td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge status={tenant.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {invite ? (
                        <span>
                          {invite.email}
                          <span className="block text-xs text-slate-500">
                            expira{" "}
                            {new Date(invite.expires_at).toLocaleDateString(
                              "es-AR",
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TenantRowActions
                        tenantId={tenant.id}
                        tenantName={tenant.name}
                        status={tenant.status}
                        hasPendingInvite={Boolean(invite)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageWrapper>
  );
}
