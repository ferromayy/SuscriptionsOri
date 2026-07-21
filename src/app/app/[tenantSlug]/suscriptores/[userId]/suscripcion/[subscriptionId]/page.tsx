import Link from "next/link";
import { notFound } from "next/navigation";

import { ManageSubscriptionForm } from "@/components/subscriptions/manage-subscription-form";
import { getTenantMpConnection } from "@/lib/mercadopago/oauth";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getSubscriberSubscription } from "@/lib/subscribers/get-subscription-for-edit";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function ManagerEditSubscriptionPage({
  params,
}: {
  params: Promise<{
    tenantSlug: string;
    userId: string;
    subscriptionId: string;
  }>;
}) {
  const { tenantSlug, userId, subscriptionId } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/${userId}/suscripcion/${subscriptionId}`,
    requireManager: true,
  });

  const subscription = await getSubscriberSubscription(
    subscriptionId,
    userId,
    tenant.id,
  );

  if (!subscription) {
    notFound();
  }

  const plans = await getActivePlansForTenant(tenant.id);
  const plan = plans.find((item) => item.id === subscription.planId);

  if (!plan) {
    return (
      <div className="ori-container py-16">
        <h1 className="ori-title">Suscripción no disponible</h1>
        <p className="mt-4 text-sm text-gray-600">
          Este plan ya no está activo en el catálogo.
        </p>
        <Link
          href={`/app/${tenant.slug}/suscriptores/${userId}`}
          className="mt-4 inline-block text-sm text-gray-700 hover:text-gray-900"
        >
          ← Volver a la ficha
        </Link>
      </div>
    );
  }

  const mpConnection = await getTenantMpConnection(tenant.id);

  return (
    <div className="ori-container py-16">
      <Link
        href={`/app/${tenant.slug}/suscriptores/${userId}`}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a la ficha
      </Link>

      <p className="ori-eyebrow mt-6">{tenant.name}</p>
      <h1 className="ori-title mt-2">{plan.name}</h1>
      <p className="ori-subtitle mt-4">
        Editá las opciones de la suscripción como lo haría el suscriptor. El
        precio se recalcula al guardar.
      </p>

      <ManageSubscriptionForm
        tenantSlug={tenant.slug}
        plans={[plan]}
        mode="edit"
        lockedPlanId={plan.id}
        initialChoices={subscription.choices}
        initialBillingCycleDays={subscription.billingCycleDays}
        submitLabel="Guardar cambios"
        actingAsUserId={userId}
        paymentOptions={{
          cardsEnabled: false,
          transferEnabled: Boolean(
            mpConnection?.transferAlias || mpConnection?.transferCbu,
          ),
          transferAlias: mpConnection?.transferAlias ?? null,
          transferCbu: mpConnection?.transferCbu ?? null,
          transferHolderName: mpConnection?.transferHolderName ?? null,
        }}
      />
    </div>
  );
}
