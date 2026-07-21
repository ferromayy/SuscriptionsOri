import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmTransferButton } from "@/components/subscribers/confirm-transfer-button";
import { SendAccessLinkButton } from "@/components/subscribers/send-access-link-button";
import { SubscriptionStatusActions } from "@/components/subscribers/subscription-status-actions";
import { createDbClient } from "@/lib/db/client";
import { billingCycleLabel, formatCents } from "@/lib/plans/money";
import { getPaymentReceiptSignedUrl } from "@/lib/storage/payment-receipts";
import {
  formatCycleDate,
  getNextCycleDate,
  normalizeBillingCycleDays,
} from "@/lib/subscribers/billing-cycle";
import {
  deliveryMethodLabel,
  paymentMethodLabel,
  paymentStatusLabel,
  subscriptionStatusLabel,
} from "@/lib/subscribers/status-labels";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";
import type {
  DeliveryMethod,
  Json,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@/types/database";

export default async function SubscriberDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; userId: string }>;
}) {
  const { tenantSlug, userId } = await params;
  const { tenant } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}/suscriptores/${userId}`,
    requireManager: true,
  });

  const db = createDbClient();

  const { data: member } = await db
    .from("tenant_members")
    .select("id, status, joined_via, created_at")
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .eq("role", "subscriber")
    .is("deleted_at", null)
    .maybeSingle();

  if (!member) {
    notFound();
  }

  const { data: user } = await db
    .from("users")
    .select("id, email, full_name, email_verified_at, created_at")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user) {
    notFound();
  }

  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      "id, plan_id, status, payment_status, final_price_cents, contact_email, contact_phone, contact_first_name, contact_last_name, delivery_method, delivery_details, payment_method, billing_interval, billing_cycle_days, payment_reference, payment_receipt_path, mp_preapproval_id, mp_last_rejection_detail, mp_last_rejection_at, created_at, updated_at",
    )
    .eq("tenant_id", tenant.id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const planIds = [...new Set((subscriptions ?? []).map((s) => s.plan_id))];
  const plansById = new Map<string, { name: string; currency: string }>();
  if (planIds.length > 0) {
    const { data: plans } = await db
      .from("plans")
      .select("id, name, currency")
      .in("id", planIds)
      .is("deleted_at", null);
    for (const plan of plans ?? []) {
      plansById.set(plan.id, { name: plan.name, currency: plan.currency });
    }
  }

  const subscriptionIds = (subscriptions ?? []).map((s) => s.id);
  const choicesBySubscription = new Map<
    string,
    Array<{
      fieldLabel: string;
      optionLabel: string | null;
      textValue: string | null;
    }>
  >();

  if (subscriptionIds.length > 0) {
    const { data: choices } = await db
      .from("subscription_choices")
      .select("subscription_id, field_id, option_id, text_value")
      .in("subscription_id", subscriptionIds)
      .is("deleted_at", null);

    const fieldIds = [...new Set((choices ?? []).map((c) => c.field_id))];
    const optionIds = [
      ...new Set(
        (choices ?? [])
          .map((c) => c.option_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const fieldsById = new Map<string, string>();
    if (fieldIds.length > 0) {
      const { data: fields } = await db
        .from("plan_fields")
        .select("id, label")
        .in("id", fieldIds)
        .is("deleted_at", null);
      for (const field of fields ?? []) {
        fieldsById.set(field.id, field.label);
      }
    }

    const optionsById = new Map<string, string>();
    if (optionIds.length > 0) {
      const { data: options } = await db
        .from("plan_field_options")
        .select("id, label")
        .in("id", optionIds)
        .is("deleted_at", null);
      for (const option of options ?? []) {
        optionsById.set(option.id, option.label);
      }
    }

    for (const choice of choices ?? []) {
      const list = choicesBySubscription.get(choice.subscription_id) ?? [];
      list.push({
        fieldLabel: fieldsById.get(choice.field_id) ?? "Campo",
        optionLabel: choice.option_id
          ? (optionsById.get(choice.option_id) ?? null)
          : null,
        textValue: choice.text_value,
      });
      choicesBySubscription.set(choice.subscription_id, list);
    }
  }

  const receiptUrls = new Map<string, string>();
  for (const sub of subscriptions ?? []) {
    if (!sub.payment_receipt_path) continue;
    const url = await getPaymentReceiptSignedUrl(sub.payment_receipt_path);
    if (url) receiptUrls.set(sub.id, url);
  }

  const latest = subscriptions?.[0];
  const displayName =
    [latest?.contact_first_name, latest?.contact_last_name]
      .filter(Boolean)
      .join(" ") ||
    user.full_name ||
    "Suscriptor";

  return (
    <div className="ori-container py-16">
      <Link
        href={`/app/${tenant.slug}/suscriptores`}
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Volver a suscriptores
      </Link>

      <p className="ori-eyebrow mt-6">{tenant.name}</p>
      <h1 className="ori-title mt-2">{displayName}</h1>
      <p className="ori-subtitle mt-4">
        Ficha completa del suscriptor (sin contraseña).
      </p>

      <div className="mt-6">
        <Link
          href={`/app/${tenant.slug}/suscriptores/${userId}/agregar`}
          className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Agregar suscripción
        </Link>
      </div>

      <section className="mt-8 ori-card space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Cuenta</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Email de cuenta</dt>
            <dd className="font-medium text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Nombre en cuenta</dt>
            <dd className="text-gray-900">{user.full_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email verificado</dt>
            <dd className="text-gray-900">
              {user.email_verified_at
                ? new Date(user.email_verified_at).toLocaleString("es-AR")
                : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Miembro desde</dt>
            <dd className="text-gray-900">
              {new Date(member.created_at).toLocaleString("es-AR")}
              <span className="block text-xs text-gray-500">
                vía {member.joined_via}
              </span>
            </dd>
          </div>
        </dl>
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-600">
            Si no tiene contraseña o no la recuerda, enviále un link para que la
            cree ella misma. Vos no ves ni definís la contraseña.
          </p>
          <div className="mt-3">
            <SendAccessLinkButton
              tenantSlug={tenant.slug}
              userId={user.id}
            />
          </div>
        </div>
      </section>

      {(subscriptions ?? []).length === 0 ? (
        <section className="mt-8 ori-card">
          <p className="text-sm text-gray-600">
            Este suscriptor todavía no tiene suscripciones.
          </p>
        </section>
      ) : (
        <div className="mt-8 space-y-6">
          {(subscriptions ?? []).map((subscription) => {
            const plan = plansById.get(subscription.plan_id);
            const choices = choicesBySubscription.get(subscription.id) ?? [];
            const receiptUrl = receiptUrls.get(subscription.id);
            const deliveryDetails = (subscription.delivery_details ??
              {}) as Record<string, Json>;
            const cycleDays = normalizeBillingCycleDays(
              subscription.billing_cycle_days,
            );
            const nextDate = getNextCycleDate(
              subscription.created_at,
              cycleDays,
            );

            return (
              <section key={subscription.id} className="ori-card space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {plan?.name ?? "Suscripción"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {subscriptionStatusLabel(
                        subscription.status as SubscriptionStatus,
                      )}{" "}
                      ·{" "}
                      {formatCents(
                        subscription.final_price_cents ?? 0,
                        plan?.currency ?? "ars",
                        cycleDays,
                      )}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {billingCycleLabel(cycleDays)} · próximo envío{" "}
                      {formatCycleDate(nextDate)}
                    </p>
                    <Link
                      href={`/app/${tenant.slug}/suscriptores/${userId}/suscripcion/${subscription.id}`}
                      className="mt-2 inline-block text-sm font-medium text-gray-800 underline-offset-4 hover:underline"
                    >
                      Editar opciones
                    </Link>
                  </div>
                  <SubscriptionStatusActions
                    tenantSlug={tenant.slug}
                    subscriptionId={subscription.id}
                    status={subscription.status}
                  />
                </div>

                {subscription.status === "pending_payment" &&
                  subscription.payment_method === "transfer" && (
                    <ConfirmTransferButton
                      tenantSlug={tenant.slug}
                      subscriptionId={subscription.id}
                    />
                  )}

                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Contacto de la suscripción
                  </h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-500">Nombre</dt>
                      <dd className="text-gray-900">
                        {[
                          subscription.contact_first_name,
                          subscription.contact_last_name,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Email</dt>
                      <dd className="text-gray-900">
                        {subscription.contact_email ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Teléfono</dt>
                      <dd className="text-gray-900">
                        {subscription.contact_phone ?? "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900">Entrega</h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {deliveryMethodLabel(
                      subscription.delivery_method as DeliveryMethod | null,
                    )}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {Object.entries(deliveryDetails).map(([key, value]) =>
                      value ? (
                        <li key={key}>
                          <span className="text-gray-500">{key}: </span>
                          {String(value)}
                        </li>
                      ) : null,
                    )}
                  </ul>
                </div>

                {choices.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      Opciones del plan
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600">
                      {choices.map((choice, index) => (
                        <li key={`${choice.fieldLabel}-${index}`}>
                          <span className="text-gray-500">
                            {choice.fieldLabel}:{" "}
                          </span>
                          {choice.optionLabel ?? choice.textValue ?? "—"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-gray-900">Pago</h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-500">Método</dt>
                      <dd className="text-gray-900">
                        {paymentMethodLabel(
                          subscription.payment_method as PaymentMethod | null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Estado de pago</dt>
                      <dd className="text-gray-900">
                        {paymentStatusLabel(
                          subscription.payment_status as PaymentStatus | null,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Referencia</dt>
                      <dd className="text-gray-900">
                        {subscription.payment_reference ?? "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Comprobante</dt>
                      <dd className="text-gray-900">
                        {receiptUrl ? (
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Ver archivo
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    {subscription.mp_preapproval_id && (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-500">MP preapproval</dt>
                        <dd className="font-mono text-xs text-gray-900">
                          {subscription.mp_preapproval_id}
                        </dd>
                      </div>
                    )}
                    {subscription.mp_last_rejection_detail && (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-500">Último rechazo MP</dt>
                        <dd className="text-gray-900">
                          {subscription.mp_last_rejection_detail}
                          {subscription.mp_last_rejection_at && (
                            <span className="block text-xs text-gray-500">
                              {new Date(
                                subscription.mp_last_rejection_at,
                              ).toLocaleString("es-AR")}
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <p className="text-xs text-gray-500">
                  Creada{" "}
                  {new Date(subscription.created_at).toLocaleString("es-AR")} ·
                  actualizada{" "}
                  {new Date(subscription.updated_at).toLocaleString("es-AR")}
                </p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
