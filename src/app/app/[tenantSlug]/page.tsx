import Link from "next/link";

import { createDbClient } from "@/lib/db/client";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";
import { isTenantManager } from "@/lib/auth/permissions";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}`,
  });

  const db = createDbClient();

  const { count: memberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber");

  const { data: subscription } = await db
    .from("subscriptions")
    .select("status, plan_id")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  let planName: string | null = null;
  if (subscription?.plan_id) {
    const { data: plan } = await db
      .from("plans")
      .select("name")
      .eq("id", subscription.plan_id)
      .maybeSingle();
    planName = plan?.name ?? null;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">
        {role === "subscriber" ? "Mi suscripción" : "Panel del cliente"}
      </h1>
      <p className="mt-2 text-gray-600">
        Sesión: {user.email} · Rol: {role}
      </p>

      {role === "subscriber" && (
        <div className="mt-8 ori-card">
          <p className="text-sm text-gray-600">Tu plan</p>
          <p className="mt-2 text-xl font-semibold">
            {planName ?? "Suscripción activa"}
          </p>
          <p className="mt-1 text-sm capitalize text-gray-500">
            Estado: {subscription?.status ?? "active"}
          </p>
        </div>
      )}

      {isTenantManager(role) && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="ori-card">
              <p className="text-sm text-gray-600">Estado del tenant</p>
              <p className="mt-2 text-xl font-semibold capitalize">{tenant.status}</p>
            </div>
            <div className="ori-card">
              <p className="text-sm text-gray-600">Suscriptos</p>
              <p className="mt-2 text-3xl font-semibold">{memberCount ?? 0}</p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href={`/app/${tenant.slug}/suscriptores`}
              className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-800 hover:border-gray-400"
            >
              Gestionar registro de suscriptos →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
