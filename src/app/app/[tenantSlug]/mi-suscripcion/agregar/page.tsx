import Link from "next/link";

import { ManageSubscriptionForm } from "@/components/subscriptions/manage-subscription-form";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getSubscriberPlanIds } from "@/lib/subscribers/get-subscription-for-edit";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function AddSubscriptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/mi-suscripcion/agregar`,
  });

  if (role !== "subscriber") {
    return (
      <SubscriberShell tenantName={tenant.name}>
        <p className="text-sm text-gray-600">
          Esta sección es solo para suscriptos.
        </p>
        <Link
          href={`/app/${tenant.slug}`}
          className="mt-4 inline-block text-sm text-gray-700 hover:text-gray-900"
        >
          ← Volver al panel
        </Link>
      </SubscriberShell>
    );
  }

  const allPlans = await getActivePlansForTenant(tenant.id);
  const ownedPlanIds = new Set(
    await getSubscriberPlanIds(user.id, tenant.id),
  );
  const availablePlans = allPlans.filter((plan) => !ownedPlanIds.has(plan.id));
  const mpConnection = await getTenantMpConnection(tenant.id);
  const paymentOptions = {
    cardsEnabled: Boolean(mpConnection),
    transferEnabled: Boolean(
      mpConnection?.transferAlias || mpConnection?.transferCbu,
    ),
    transferAlias: mpConnection?.transferAlias ?? null,
    transferCbu: mpConnection?.transferCbu ?? null,
    transferHolderName: mpConnection?.transferHolderName ?? null,
  };

  return (
    <SubscriberShell tenantName={tenant.name}>
      <p className="ori-eyebrow">Nueva suscripción</p>
      <h1 className="ori-title mt-2">Agregar suscripción</h1>
      <p className="ori-subtitle mt-4">
        Elegí un tipo de suscripción que todavía no tenés activo.
      </p>
      <Link
        href={`/app/${tenant.slug}`}
        className="mt-4 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a mis suscripciones
      </Link>

      {availablePlans.length === 0 ? (
        <div className="mt-8 ori-card">
          <p className="text-sm text-gray-600">
            Ya tenés activas todas las suscripciones disponibles. Podés hacer
            clic en una existente para actualizar sus opciones.
          </p>
        </div>
      ) : (
        <ManageSubscriptionForm
          tenantSlug={tenant.slug}
          plans={availablePlans}
          mode="add"
          submitLabel="Agregar suscripción"
          paymentOptions={paymentOptions}
        />
      )}
    </SubscriberShell>
  );
}

function SubscriberShell({
  children,
  tenantName,
}: {
  children: React.ReactNode;
  tenantName: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gray-500">{tenantName}</p>
      {children}
    </div>
  );
}
