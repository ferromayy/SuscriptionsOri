import Link from "next/link";

import { CopyLinkButton } from "@/components/tenant/copy-link-button";
import { createDbClient } from "@/lib/db/client";
import { formatPlanPrice } from "@/lib/plans/format-price";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getTenantJoinUrl } from "@/lib/tenants/join-url";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function TenantSubscribersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores`,
    requireManager: true,
  });

  const db = createDbClient();
  const joinUrl = getTenantJoinUrl(tenant.slug);
  const joinPath = `/app/${tenant.slug}/join?preview=1`;

  const { count: subscriberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber");

  const plans = await getActivePlansForTenant(tenant.id);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Registro de suscriptos</h1>
      <p className="ori-subtitle mt-4">
        Compartí este link con quienes quieran suscribirse. Al registrarse,
        quedarán asociados a tu organización.
      </p>

      <section className="mt-8 ori-card">
        <h2 className="text-lg font-medium text-gray-900">Link público</h2>
        <p className="mt-2 text-sm text-gray-600">
          Los suscriptos usan esta URL para crear su cuenta y elegir un plan.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-white px-4 py-3 font-mono text-sm text-gray-900">
            {joinUrl}
          </p>
          <CopyLinkButton url={joinUrl} />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={joinPath}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Ver formulario público
          </Link>
        </div>

        {!tenant.allowPublicSignup && (
          <p className="mt-4 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            El registro público está deshabilitado. Los suscriptos no podrán
            completar el formulario hasta que lo actives.
          </p>
        )}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Suscriptos activos</p>
          <p className="mt-2 text-3xl font-semibold">{subscriberCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-gray-600">Planes disponibles</p>
          <p className="mt-2 text-3xl font-semibold">{plans.length}</p>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="mt-8 ori-card">
          <h2 className="text-lg font-medium text-gray-900">
            Planes en el formulario
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Estos son los planes que verán al registrarse.
          </p>
          <ul className="mt-4 space-y-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <span className="font-medium text-gray-900">{plan.name}</span>
                <span className="text-sm text-gray-600">
                  {formatPlanPrice(plan)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
