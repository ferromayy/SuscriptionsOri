import Link from "next/link";
import { notFound } from "next/navigation";

import { SubscriptionPlanForm } from "@/components/subscriptions/create-subscription-form";
import { getPlanByIdForTenant } from "@/lib/plans/get-plans";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; planId: string }>;
}) {
  const { tenantSlug, planId } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones/${planId}/editar`,
    requireManager: true,
  });

  const plan = await getPlanByIdForTenant(tenant.id, planId);
  if (!plan) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Editar suscripción</h1>
      <p className="ori-subtitle mt-4">
        Modificá los datos, campos y opciones de «{plan.name}».
      </p>
      <Link
        href={`/app/${tenant.slug}/suscripciones`}
        className="mt-4 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a suscripciones
      </Link>
      <SubscriptionPlanForm
        tenantSlug={tenant.slug}
        mode="edit"
        planId={plan.id}
        initialPlan={plan}
      />
    </div>
  );
}
