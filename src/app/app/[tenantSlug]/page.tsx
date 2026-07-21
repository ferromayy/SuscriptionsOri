import Link from "next/link";

import { SubscriberPaymentReminder } from "@/components/payments/payment-reminder-list";
import { TransferPaymentGuide } from "@/components/payments/transfer-payment-guide";
import { ResumePaymentButton } from "@/components/subscriptions/resume-payment-button";
import { createDbClient } from "@/lib/db/client";
import { getOpenPaymentCycles } from "@/lib/payments/payment-cycles";
import { billingCycleLabel, formatCents } from "@/lib/plans/money";
import {
  daysUntilDate,
  formatCycleDate,
  getNextCycleDate,
  getNextPaymentDueDate,
  normalizeBillingCycleDays,
} from "@/lib/subscribers/billing-cycle";
import {
  deliveryMethodLabel,
  paymentMethodLabel,
} from "@/lib/subscribers/status-labels";
import { requireTenantAccess } from "@/lib/tenants/require-tenant-access";
import { isTenantManager } from "@/lib/auth/permissions";
import type { DeliveryMethod, PaymentMethod } from "@/types/database";

function statusLabel(status: string) {
  switch (status) {
    case "pending_payment":
      return "Esperando confirmación de transferencia";
    case "pending_authorization":
      return "Falta autorizar en Mercado Pago";
    case "active":
      return "Activa";
    case "cancelled":
      return "Cancelada";
    case "past_due":
      return "Vencida";
    case "trialing":
      return "Prueba";
    default:
      return status;
  }
}

export default async function TenantDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ payment?: string; reset?: string }>;
}) {
  const { tenantSlug } = await params;
  const { payment, reset } = await searchParams;
  const { user, tenant, role } = await requireTenantAccess(tenantSlug, {
    nextPath: `/app/${tenantSlug}`,
  });

  const db = createDbClient();

  const { count: memberCount } = await db
    .from("tenant_members")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("role", "subscriber")
    .is("deleted_at", null);

  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      "id, status, plan_id, final_price_cents, created_at, payment_method, payment_reference, billing_cycle_days, contact_email, contact_phone, contact_first_name, contact_last_name, delivery_method, delivery_details, mp_init_point",
    )
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const openPaymentCycles =
    role === "subscriber"
      ? await getOpenPaymentCycles({ tenantId: tenant.id, userId: user.id })
      : [];

  const planIds = [...new Set((subscriptions ?? []).map((sub) => sub.plan_id))];
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
  const latestPaidDueBySubscription = new Map<string, string>();
  if (subscriptionIds.length > 0) {
    const { data: paidEvents } = await db
      .from("payment_events")
      .select("subscription_id, due_on, paid_at, created_at")
      .in("subscription_id", subscriptionIds)
      .in("kind", ["confirmed", "charged"])
      .order("paid_at", { ascending: false, nullsFirst: false });
    for (const event of paidEvents ?? []) {
      if (!latestPaidDueBySubscription.has(event.subscription_id)) {
        latestPaidDueBySubscription.set(
          event.subscription_id,
          event.due_on ?? event.paid_at ?? event.created_at,
        );
      }
    }
  }
  const choicesBySub = new Map<
    string,
    Array<{ fieldLabel: string; value: string }>
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
    const optionsById = new Map<string, string>();

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
      const list = choicesBySub.get(choice.subscription_id) ?? [];
      list.push({
        fieldLabel: fieldsById.get(choice.field_id) ?? "Opción",
        value:
          (choice.option_id
            ? optionsById.get(choice.option_id)
            : choice.text_value) ?? "—",
      });
      choicesBySub.set(choice.subscription_id, list);
    }
  }

  return (
    <div className="ori-container py-12 sm:py-16">
      <p className="ori-eyebrow">{tenant.name}</p>
      <h1 className="ori-title mt-2">
        {role === "subscriber" ? "Mis suscripciones" : "Panel"}
      </h1>
      <p className="mt-2 text-sm text-gray-500">{user.email}</p>

      {reset === "1" && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Contraseña actualizada. Ya podés usar tu cuenta.
        </p>
      )}

      {payment === "return" && role === "subscriber" && (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Volviste de Mercado Pago. Si autorizaste el cobro, tu suscripción se
          va a activar en unos segundos.
        </p>
      )}

      {role === "subscriber" && (
        <div className="mt-8 space-y-4">
          {(subscriptions ?? []).length === 0 ? (
            <div className="ori-card">
              <p className="text-sm text-gray-600">
                Todavía no tenés suscripciones activas.
              </p>
              <Link
                href={`/app/${tenant.slug}/mi-suscripcion/agregar`}
                className="ori-btn-primary mt-4 inline-flex"
              >
                Agregar suscripción
              </Link>
            </div>
          ) : (
            (subscriptions ?? []).map((subscription) => {
              const plan = plansById.get(subscription.plan_id);
              const cycleDays = normalizeBillingCycleDays(
                subscription.billing_cycle_days,
              );
              const nextDate = getNextCycleDate(
                subscription.created_at,
                cycleDays,
              );
              const openPaymentCycle = openPaymentCycles.find(
                (cycle) => cycle.subscriptionId === subscription.id,
              );
              const nextPaymentDue = openPaymentCycle
                ? new Date(`${openPaymentCycle.dueOn}T12:00:00`)
                : getNextPaymentDueDate(
                    latestPaidDueBySubscription.get(subscription.id),
                    subscription.created_at,
                    cycleDays,
                  );
              const daysUntilPayment = daysUntilDate(nextPaymentDue);
              const showTransferReminder =
                subscription.payment_method === "transfer" &&
                Boolean(openPaymentCycle) &&
                openPaymentCycle?.status !== "submitted" &&
                daysUntilPayment <= 7;
              const renewalSubmitted =
                subscription.payment_method === "transfer" &&
                openPaymentCycle?.status === "submitted";
              const needsCardPayment =
                subscription.status === "pending_authorization" &&
                (subscription.payment_method === "card_monthly" ||
                  subscription.payment_method === "card_annual");
              const isTransferPending =
                subscription.status === "pending_payment" &&
                subscription.payment_method === "transfer";
              const deliveryDetails = (subscription.delivery_details ??
                {}) as Record<string, string>;
              const choices = choicesBySub.get(subscription.id) ?? [];

              return (
                <div key={subscription.id} className="ori-card space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Suscripción</p>
                      <p className="mt-2 text-xl font-semibold text-gray-900">
                        {plan?.name ?? "Plan"}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Estado: {statusLabel(subscription.status)}
                      </p>
                    </div>
                    <Link
                      href={`/app/${tenant.slug}/mi-suscripcion/${subscription.id}`}
                      className="text-sm font-medium text-gray-800 underline-offset-4 hover:underline"
                    >
                      Editar →
                    </Link>
                  </div>

                  <div className="border-t border-gray-200" />

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-gray-600">Frecuencia</dt>
                      <dd className="font-medium text-gray-900">
                        {billingCycleLabel(cycleDays)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Próximo envío / cobro</dt>
                      <dd className="font-medium text-gray-900">
                        {formatCycleDate(nextDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Importe por ciclo</dt>
                      <dd className="text-gray-900">
                        {subscription.final_price_cents !== null && plan
                          ? formatCents(
                              subscription.final_price_cents,
                              plan.currency,
                              cycleDays,
                            )
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Inicio</dt>
                      <dd className="text-gray-900">
                        {new Date(subscription.created_at).toLocaleDateString(
                          "es-AR",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Contacto</dt>
                      <dd className="text-gray-900">
                        {[
                          subscription.contact_first_name,
                          subscription.contact_last_name,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                        <span className="block text-gray-600">
                          {subscription.contact_email ?? "—"}
                        </span>
                        <span className="block text-gray-600">
                          {subscription.contact_phone ?? "—"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Entrega</dt>
                      <dd className="text-gray-900">
                        {deliveryMethodLabel(
                          subscription.delivery_method as DeliveryMethod | null,
                        )}
                        <ul className="mt-1 space-y-0.5 text-gray-600">
                          {Object.entries(deliveryDetails).map(([key, value]) =>
                            value ? (
                              <li key={key}>
                                {key}: {value}
                              </li>
                            ) : null,
                          )}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-600">Pago</dt>
                      <dd className="text-gray-900">
                        {paymentMethodLabel(
                          subscription.payment_method as PaymentMethod | null,
                        )}
                        {subscription.payment_reference && (
                          <span className="block text-gray-600">
                            Op.: {subscription.payment_reference}
                          </span>
                        )}
                      </dd>
                    </div>
                    {choices.length > 0 && (
                      <div className="sm:col-span-2">
                        <dt className="text-gray-600">Opciones del plan</dt>
                        <dd className="mt-1 space-y-1 text-gray-900">
                          {choices.map((choice, index) => (
                            <p key={`${choice.fieldLabel}-${index}`}>
                              <span className="text-gray-600">
                                {choice.fieldLabel}:{" "}
                              </span>
                              {choice.value}
                            </p>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <p className="text-xs text-gray-600">
                    Los cambios que hagas aplican para el próximo envío.
                  </p>

                  {needsCardPayment && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-900">
                        Todavía falta autorizar el cobro en Mercado Pago.
                      </p>
                      <ResumePaymentButton
                        tenantSlug={tenant.slug}
                        subscriptionId={subscription.id}
                        defaultEmail={
                          subscription.contact_email ?? user.email
                        }
                      />
                    </div>
                  )}

                  {isTransferPending && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Tu transferencia está pendiente de confirmación del
                      comercio.
                    </p>
                  )}

                  {renewalSubmitted && !isTransferPending && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Recibimos el comprobante de este ciclo. Está esperando
                      confirmación del comercio.
                    </p>
                  )}

                  {subscription.payment_method === "transfer" &&
                    !showTransferReminder && (
                    <TransferPaymentGuide
                      tenantSlug={tenant.slug}
                      variant="compact"
                    />
                  )}

                  {showTransferReminder && (
                    <SubscriberPaymentReminder
                      tenantSlug={tenant.slug}
                      dueDateLabel={formatCycleDate(nextPaymentDue)}
                      daysUntilDue={daysUntilPayment}
                    />
                  )}
                </div>
              );
            })
          )}

          <Link
            href={`/app/${tenant.slug}/mi-suscripcion/agregar`}
            className="ori-btn-secondary inline-flex"
          >
            + Agregar otra suscripción
          </Link>
        </div>
      )}

      {isTenantManager(role) && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="ori-card">
            <p className="text-sm text-gray-600">Dashboard</p>
            <p className="mt-2 text-sm text-gray-700">
              Métricas de suscriptores, ingresos y entregas.
            </p>
            <Link
              href={`/app/${tenant.slug}/dashboard`}
              className="mt-4 inline-block text-sm text-gray-800 underline"
            >
              Ver métricas
            </Link>
          </div>
          <div className="ori-card">
            <p className="text-sm text-gray-600">Suscriptores</p>
            <p className="mt-2 text-3xl font-semibold">{memberCount ?? 0}</p>
            <Link
              href={`/app/${tenant.slug}/suscriptores`}
              className="mt-4 inline-block text-sm text-gray-800 underline"
            >
              Ver suscriptores
            </Link>
          </div>
          <div className="ori-card">
            <p className="text-sm text-gray-600">Suscripciones</p>
            <p className="mt-2 text-sm text-gray-700">
              Planes, precios y opciones del catálogo.
            </p>
            <Link
              href={`/app/${tenant.slug}/suscripciones`}
              className="mt-4 inline-block text-sm text-gray-800 underline"
            >
              Administrar planes
            </Link>
          </div>
          <div className="ori-card">
            <p className="text-sm text-gray-600">Pagos</p>
            <p className="mt-2 text-sm text-gray-700">
              Mercado Pago, transferencia e historial.
            </p>
            <Link
              href={`/app/${tenant.slug}/pagos`}
              className="mt-4 inline-block text-sm text-gray-800 underline"
            >
              Ir a Pagos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
