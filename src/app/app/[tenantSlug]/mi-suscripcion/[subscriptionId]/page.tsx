import Link from "next/link";
import { notFound } from "next/navigation";

import { ManageSubscriptionForm } from "@/components/subscriptions/manage-subscription-form";
import { billingCycleLabel, formatCents } from "@/lib/plans/money";
import { getActivePlansForTenant } from "@/lib/plans/get-plans";
import {
  formatCycleDate,
  getNextCycleDate,
} from "@/lib/subscribers/billing-cycle";
import { getSubscriberSubscription } from "@/lib/subscribers/get-subscription-for-edit";
import {
  deliveryMethodLabel,
  paymentMethodLabel,
} from "@/lib/subscribers/status-labels";
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
  const nextDate = getNextCycleDate(
    subscription.createdAt,
    subscription.billingCycleDays,
  );

  if (!plan) {
    return (
      <div className="ori-container py-16">
        <p className="text-xs uppercase tracking-widest text-gray-500">
          {tenant.name}
        </p>
        <h1 className="ori-title mt-2">Suscripción no disponible</h1>
        <p className="mt-4 text-sm text-gray-600">
          Esta suscripción ya no está activa en el catálogo.
        </p>
        <Link
          href={`/app/${tenant.slug}`}
          className="mt-4 inline-block text-sm text-gray-700 hover:text-gray-900"
        >
          ← Volver a mis suscripciones
        </Link>
      </div>
    );
  }

  return (
    <div className="ori-container py-16">
      <p className="text-xs uppercase tracking-widest text-gray-500">
        {tenant.name}
      </p>
      <p className="ori-eyebrow mt-6">Actualizar</p>
      <h1 className="ori-title mt-2">{plan.name}</h1>
      <p className="ori-subtitle mt-4">
        Revisá todos los datos. Los cambios aplican para el próximo envío (
        {formatCycleDate(nextDate)}).
      </p>
      <Link
        href={`/app/${tenant.slug}`}
        className="mt-4 inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a mis suscripciones
      </Link>

      <section className="mt-8 ori-card space-y-3 text-sm">
        <h2 className="text-base font-medium text-gray-900">
          Datos actuales
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-gray-600">Frecuencia</dt>
            <dd className="text-gray-900">
              {billingCycleLabel(subscription.billingCycleDays)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Próximo envío / cobro</dt>
            <dd className="text-gray-900">{formatCycleDate(nextDate)}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Importe</dt>
            <dd className="text-gray-900">
              {subscription.finalPriceCents !== null
                ? formatCents(
                    subscription.finalPriceCents,
                    plan.currency,
                    subscription.billingCycleDays,
                  )
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Pago</dt>
            <dd className="text-gray-900">
              {paymentMethodLabel(subscription.paymentMethod)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Contacto</dt>
            <dd className="text-gray-900">
              {[subscription.contactFirstName, subscription.contactLastName]
                .filter(Boolean)
                .join(" ") || "—"}
              <span className="block text-gray-600">
                {subscription.contactEmail ?? "—"}
              </span>
              <span className="block text-gray-600">
                {subscription.contactPhone ?? "—"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">Entrega</dt>
            <dd className="text-gray-900">
              {deliveryMethodLabel(subscription.deliveryMethod)}
              <ul className="mt-1 text-gray-600">
                {Object.entries(subscription.deliveryDetails).map(
                  ([key, value]) =>
                    value ? (
                      <li key={key}>
                        {key}: {value}
                      </li>
                    ) : null,
                )}
              </ul>
            </dd>
          </div>
        </dl>
      </section>

      <ManageSubscriptionForm
        tenantSlug={tenant.slug}
        plans={[plan]}
        mode="edit"
        lockedPlanId={plan.id}
        initialChoices={subscription.choices}
        initialBillingCycleDays={subscription.billingCycleDays}
        submitLabel="Guardar para el próximo envío"
      />
    </div>
  );
}
