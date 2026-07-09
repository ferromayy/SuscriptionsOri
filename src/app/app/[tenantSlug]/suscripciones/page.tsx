import Link from "next/link";

import { DeletePlanButton } from "@/components/subscriptions/delete-plan-button";
import { LoadCasaExampleButton } from "@/components/subscriptions/load-casa-example-button";
import { createDbClient } from "@/lib/db/client";
import { formatPlanPrice } from "@/lib/plans/format-price";
import { getPlansForTenantManager } from "@/lib/plans/get-plans";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

async function getSubscriberCountByPlan(tenantId: string) {
  const db = createDbClient();
  const { data } = await db
    .from("subscriptions")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1);
  }
  return counts;
}

export default async function TenantSubscriptionsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones`,
    requireManager: true,
  });

  const plans = await getPlansForTenantManager(tenant.id);
  const subscriberCounts = await getSubscriberCountByPlan(tenant.id);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Suscripciones</h1>
      <p className="ori-subtitle mt-4">
        Creá y administrá los tipos de suscripción que verán tus clientes en el
        link público.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={`/app/${tenant.slug}/suscripciones/nueva`} className="ori-btn-primary">
          Crear suscripción
        </Link>
        <LoadCasaExampleButton tenantSlug={tenant.slug} />
      </div>

      {plans.length === 0 ? (
        <section className="mt-8 ori-card">
          <p className="text-sm text-gray-600">
            Todavía no hay suscripciones publicadas. Creá la primera o cargá el
            ejemplo «Suscripción casa» para probar el flujo.
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          {plans.map((plan) => (
            <article key={plan.id} className="ori-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-medium text-gray-900">{plan.name}</h2>
                    {!plan.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Inactiva
                      </span>
                    )}
                  </div>
                  {plan.internalLabel && (
                    <p className="mt-1 text-sm text-gray-500">{plan.internalLabel}</p>
                  )}
                  {plan.description && (
                    <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {formatPlanPrice(plan)}
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-600">
                {plan.fieldCount} {plan.fieldCount === 1 ? "campo" : "campos"} ·{" "}
                {plan.fields.map((field) => field.label).join(", ") || "Sin campos"}
              </p>
              {(subscriberCounts.get(plan.id) ?? 0) > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  {subscriberCounts.get(plan.id)} suscriptor
                  {(subscriberCounts.get(plan.id) ?? 0) === 1 ? "" : "es"} activo
                  {(subscriberCounts.get(plan.id) ?? 0) === 1 ? "" : "s"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href={`/app/${tenant.slug}/suscripciones/${plan.id}/editar`}
                  className="text-sm font-medium text-gray-900 hover:text-gray-600"
                >
                  Editar
                </Link>
                <DeletePlanButton
                  tenantSlug={tenant.slug}
                  planId={plan.id}
                  planName={plan.name}
                  subscriberCount={subscriberCounts.get(plan.id) ?? 0}
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
