import Link from "next/link";
import { notFound } from "next/navigation";

import { ManageSubscriptionForm } from "@/components/subscriptions/manage-subscription-form";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import { getSubscriberSubscription } from "@/lib/subscribers/get-subscription-for-edit";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; subscriptionId: string }>;
}) {
  const { tenantSlug, subscriptionId } = await params;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/mi-suscripcion/${subscriptionId}`,
  });

  if (role !== "subscriber") {
    notFound();
  }

  const subscription = await getSubscriberSubscription(
    subscriptionId,
    user.id,
    tenant.id,
  );

  if (!subscription) {
    notFound();
  }

  const plans = await getActivePlansForTenant(tenant.id);
  const plan = plans.find((item) => item.id === subscription.planId);

  if (!plan) {
    return (
      <SubscriberShell tenantName={tenant.name}>
        <h1 className="ori-title">Suscripción no disponible</h1>
        <p className="mt-4 text-sm text-gray-600">
          Esta suscripción ya no está activa en el catálogo.
        </p>
        <Link
          href={`/app/${tenant.slug}`}
          className="mt-4 inline-block text-sm text-gray-700 hover:text-gray-900"
        >
          ← Volver a mis suscripciones
        </Link>
      </SubscriberShell>
    );
  }

  return (
    <SubscriberShell tenantName={tenant.name}>
      <p className="ori-eyebrow">Actualizar</p>
      <h1 className="ori-title mt-2">{plan.name}</h1>
      <p className="ori-subtitle mt-4">
        Modificá las opciones de esta suscripción. El precio se recalcula al
        guardar.
      </p>
      <Link
        href={`/app/${tenant.slug}`}
        className="mt-4 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a mis suscripciones
      </Link>

      <ManageSubscriptionForm
        tenantSlug={tenant.slug}
        plans={[plan]}
        mode="edit"
        lockedPlanId={plan.id}
        initialChoices={subscription.choices}
        submitLabel="Guardar cambios"
      />
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
