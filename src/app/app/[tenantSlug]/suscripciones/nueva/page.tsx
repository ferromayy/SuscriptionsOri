import Link from "next/link";

import { SubscriptionPlanForm } from "@/components/subscriptions/create-subscription-form";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function NewSubscriptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscripciones/nueva`,
    requireManager: true,
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">Nueva suscripción</h1>
      <p className="ori-subtitle mt-4">
        Completá los tres pasos para publicar un nuevo tipo de suscripción.
      </p>
      <Link
        href={`/app/${tenant.slug}/suscripciones`}
        className="mt-4 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a suscripciones
      </Link>
      <SubscriptionPlanForm tenantSlug={tenant.slug} mode="create" />
    </div>
  );
}
